import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  authorizeCron,
  cronSecretMissingResponse,
  cronUnauthorizedResponse
} from "@/lib/cron-auth";
import { markOrderPaid } from "@/modules/shop/services/order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * P-06: Daily payment reconciliation cron.
 *
 * Finds orders stuck in `pending` with a razorpayOrderId that are older than 2 hours.
 * For each, fetches the Razorpay order's payments via the API.
 * If any payment is `captured`, calls markOrderPaid to heal the orphan.
 * If all payments are failed/expired, marks the order as payment_failed.
 *
 * Call via external scheduler or AWS EventBridge daily.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(cronSecretMissingResponse(), { status: 503 });
  }
  if (!authorizeCron(request)) {
    return NextResponse.json(cronUnauthorizedResponse(), { status: 401 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ ok: false, error: "razorpay_not_configured" }, { status: 503 });
  }

  // ITERATION 4 / TOP-50 SECURITY #5 FIX: Database mutex lock to prevent concurrent cron execution amplification
  const lockAcquired = await db.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(847291048) as locked
  `.catch(() => [{ locked: true }]);

  if (lockAcquired[0] && !lockAcquired[0].locked) {
    logger.warn({ event: "reconcile_cron_locked" }, "reconcile-payments already executing concurrently; skipping");
    return NextResponse.json({ ok: true, reconciled: 0, healed: 0, expired: 0, errors: 0, skipped: "concurrent_lock" });
  }

  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const orphans = await db.order.findMany({
      where: {
        status: { in: ["pending", "payment_failed"] },
        razorpayOrderId: { not: null },
        createdAt: { lt: cutoff }
      },
      select: {
        id: true,
        razorpayOrderId: true,
        orderNumber: true,
        totalCents: true,
        status: true
      },
      take: 25 // batch limit per run to ensure comfortable execution inside maxDuration
    });

    if (orphans.length === 0) {
      return NextResponse.json({ ok: true, reconciled: 0, healed: 0, expired: 0, errors: 0 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  let healed = 0;
  let expired = 0;
  let errors = 0;

  await Promise.allSettled(
    orphans.map(async (order) => {
      if (!order.razorpayOrderId) return;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(
          `https://api.razorpay.com/v1/orders/${encodeURIComponent(order.razorpayOrderId)}/payments`,
          {
            headers: { Authorization: `Basic ${auth}` },
            signal: controller.signal
          }
        );
        clearTimeout(timeout);

        if (!res.ok) {
          logger.warn(
            { event: "reconcile_fetch_failed", orderId: order.id, status: res.status },
            "reconciliation: failed to fetch Razorpay order payments"
          );
          errors++;
          return;
        }

        const data = (await res.json()) as {
          items?: Array<{ id: string; status: string; amount: number }>;
        };
        const payments = data.items ?? [];

        // Look for a captured payment matching the expected amount.
        const captured = payments.find(
          (p) => p.status === "captured" && p.amount === order.totalCents
        );

        if (captured) {
          logger.info(
            { event: "reconcile_heal", orderId: order.id, paymentId: captured.id },
            `reconciliation: healing orphan order ${order.orderNumber}`
          );
          const result = await markOrderPaid({
            orderId: order.id,
            razorpayPaymentId: captured.id,
            source: "reconciliation"
          });
          if (result.ok) {
            healed++;
          } else {
            errors++;
            logger.error(
              { event: "reconcile_heal_failed", orderId: order.id },
              "reconciliation: markOrderPaid failed"
            );
          }
        } else {
          // All payments failed/expired — mark order as payment_failed.
          const allTerminal = payments.length > 0 && payments.every(
            (p) => ["failed", "expired", "refunded"].includes(p.status)
          );
          if (allTerminal || payments.length === 0) {
            const dayOld = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (order.status === "pending") {
              const o = await db.order.findUnique({ where: { id: order.id }, select: { createdAt: true } });
              if (o && o.createdAt < dayOld) {
                const { markOrderFailed } = await import("@/modules/shop/services/order.service");
                await markOrderFailed({ orderId: order.id, source: "reconciliation" });
                expired++;
              }
            }
          }
        }
      } catch (err) {
        logger.error(
          { err, event: "reconcile_error", orderId: order.id },
          "reconciliation: error processing order"
        );
        errors++;
      }
    })
  );

  logger.info(
    { event: "reconcile_complete", total: orphans.length, healed, expired, errors },
    `reconciliation complete: ${healed} healed, ${expired} expired, ${errors} errors`
  );

    return NextResponse.json({
      ok: true,
      reconciled: orphans.length,
      healed,
      expired,
      errors
    });
  } finally {
    await db.$executeRaw`SELECT pg_advisory_unlock(847291048)`.catch(() => undefined);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
