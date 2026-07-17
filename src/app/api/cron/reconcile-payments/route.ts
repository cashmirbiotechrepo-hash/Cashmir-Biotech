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

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

let devCronLocked = false;

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

  // PROJECT OMEGA / CRIT-01 FIX: Distributed lock via Upstash Redis (or dev fallback) to eliminate Postgres connection pool deadlocks
  const redis = await getRedis();
  if (redis) {
    const locked = await redis.set("cron:reconcile", "1", { nx: true, ex: 120 });
    if (!locked) {
      logger.warn({ event: "reconcile_cron_locked" }, "reconcile-payments already executing concurrently; skipping");
      return NextResponse.json({ ok: true, reconciled: 0, healed: 0, expired: 0, errors: 0, skipped: "locked" });
    }
  } else {
    if (devCronLocked) {
      logger.warn({ event: "reconcile_cron_locked" }, "reconcile-payments already executing concurrently (dev lock); skipping");
      return NextResponse.json({ ok: true, reconciled: 0, healed: 0, expired: 0, errors: 0, skipped: "locked" });
    }
    devCronLocked = true;
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
      take: 25
    });

    if (!orphans.length) {
      return NextResponse.json({ ok: true, reconciled: 0, healed: 0, expired: 0, errors: 0 });
    }

    let healed = 0;
    let expired = 0;
    let errors = 0;

    const results = await Promise.allSettled(
      orphans.map(async (orphan) => {
        const url = `https://api.razorpay.com/v1/orders/${orphan.razorpayOrderId}/payments`;
        const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: authHeader, Accept: "application/json" }
        });

        if (!res.ok) {
          logger.warn(
            { status: res.status, orderId: orphan.id, razorpayOrderId: orphan.razorpayOrderId },
            "Razorpay API error when querying payments for order"
          );
          return { id: orphan.id, status: "error" as const };
        }

        const data = (await res.json()) as { items?: Array<{ id: string; status: string; amount: number }> };
        const payments = data.items ?? [];

        const captured = payments.find((p) => p.status === "captured");
        if (captured) {
          logger.info(
            { orderId: orphan.id, paymentId: captured.id, amount: captured.amount },
            "Found captured payment for orphan order during reconciliation"
          );
          const healResult = await markOrderPaid({
            orderId: orphan.id,
            razorpayPaymentId: captured.id,
            source: "reconciliation"
          });
          if (healResult.ok) {
            return { id: orphan.id, status: "healed" as const };
          }
          return { id: orphan.id, status: "error" as const };
        }

        const anyInFlight = payments.some((p) => ["authorized", "pending", "created"].includes(p.status));
        if (anyInFlight) {
          return { id: orphan.id, status: "in_flight" as const };
        }

        if (orphan.status === "pending") {
          await db.order.update({
            where: { id: orphan.id },
            data: { status: "payment_failed" }
          });
          return { id: orphan.id, status: "expired" as const };
        }

        return { id: orphan.id, status: "noop" as const };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.status === "healed") healed++;
        else if (r.value.status === "expired") expired++;
        else if (r.value.status === "error") errors++;
      } else {
        errors++;
        logger.error({ reason: r.reason }, "Unhandled rejection reconciling order");
      }
    }

    logger.info({ reconciled: orphans.length, healed, expired, errors }, "Payment reconciliation completed");
    return NextResponse.json({
      ok: true,
      reconciled: orphans.length,
      healed,
      expired,
      errors
    });
  } finally {
    if (redis) {
      await redis.del("cron:reconcile").catch(() => undefined);
    } else {
      devCronLocked = false;
    }
  }
}

export async function POST(request: Request) {
  return GET(request);
}
