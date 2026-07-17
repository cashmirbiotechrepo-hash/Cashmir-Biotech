import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { deductStockForOrder, releaseReservationForOrder } from "@/modules/admin/services/inventory.service";
import { orderLines, newConfirmationToken } from "./checkout.service";

/**
 * Called after payment is verified (Razorpay webhook / return) or when dev checkout skips payment.
 * Safe to call multiple times (idempotent). Concurrent verify+webhook is single-flight via atomic claim.
 *
 * P-02 FIX: Two-phase approach.
 *   Phase A (synchronous, fast): Atomic claim → stock deduct → coupon burn → status=paid
 *   Phase B (async via outbox): Customer attach, invoice PDF, confirmation email
 * Webhook can ack 200 as soon as Phase A completes (~100–500ms).
 */
export async function fulfillOrderAtomic(orderId: string, source: string): Promise<{ ok: boolean; confirmationToken?: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) return { ok: false };

  const lines = orderLines(order.items);

  // 1. Ensure stock is reserved before deductive fulfillment if not yet reserved
  if (!order.stockDeducted && !order.stockReserved) {
    const { reserveStockForOrder } = await import("@/modules/admin/services/inventory.service");
    const res = await reserveStockForOrder({ orderId: order.id, lines });
    if (!res.ok) {
      logger.error({ orderId: order.id, err: res.error }, "paid order but stock reservation failed");
      return { ok: false, confirmationToken: order.confirmationToken };
    }
    await db.order.update({ where: { id: order.id }, data: { stockReserved: true } });
  }

  // 2. Execute atomic transaction wrapping coupon burn AND stock deduction AND boolean tracking flags
  try {
    await db.$transaction(async (tx) => {
      // Pessimistic row lock — Read Committed alone allows two concurrent fulfillments
      // to both observe stockDeducted=false and double-deduct inventory.
      const lockedOrderList = await tx.$queryRaw<Array<{ stockDeducted: boolean }>>`
        SELECT "stockDeducted" FROM "Order" WHERE id = ${order.id} FOR UPDATE
      `;
      const lockedOrder = lockedOrderList[0];
      if (!lockedOrder || lockedOrder.stockDeducted) {
        return;
      }

      if (order.couponCode) {
        const burned = await tx.$executeRaw`
          UPDATE "Coupon"
          SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
          WHERE code = ${order.couponCode}
            AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
        `;
        if (burned === 0) {
          // ITERATION 4 / HIGH-02 FIX: Do not throw PROMO_LIMIT_BREACHED or reject fulfillment when funds are already captured.
          // Flag the order with security notes and proceed with status = 'paid' and stock deduction.
          await tx.order.update({
            where: { id: order.id },
            data: {
              adminNotes: "[SECURITY] Promotion threshold breached during concurrent payment. Review required."
            }
          });
        }
      }

      await deductStockForOrder({
        orderId: order.id,
        lines,
        releaseReserved: true,
        createdBy: `payment:${source}`,
        tx
      });
      await tx.order.update({
        where: { id: order.id },
        data: { stockDeducted: true, stockReserved: false }
      });
    });
    return { ok: true, confirmationToken: order.confirmationToken };
  } catch (err: unknown) {
    logger.error({ orderId: order.id, err }, "atomic fulfillment (stock deduct + coupon burn) failed");
    return { ok: false, confirmationToken: order.confirmationToken };
  }
}

export async function markOrderPaid(input: {
  orderId: string;
  razorpayPaymentId?: string;
  source: string;
}): Promise<{ ok: boolean; confirmationToken?: string; alreadyPaid?: boolean }> {
  const paymentId = (input.razorpayPaymentId ?? "").trim();

  // ── Phase A: Durable payment receipt ─────────────────────────────────────

  // Atomic claim: only one concurrent caller transitions pending/payment_failed → paid.
  const claimed = await db.$queryRaw<Array<{ id: string; confirmationToken: string }>>`
    UPDATE "Order"
    SET
      status = 'paid',
      "razorpayPaymentId" = CASE
        WHEN ${paymentId} <> '' THEN ${paymentId}
        ELSE "razorpayPaymentId"
      END,
      "confirmationToken" = CASE
        WHEN "confirmationToken" = '' OR "confirmationToken" IS NULL
          THEN ${newConfirmationToken()}
        ELSE "confirmationToken"
      END,
      "updatedAt" = now()
    WHERE id = ${input.orderId}
      AND status IN ('pending', 'payment_failed')
    RETURNING id, "confirmationToken"
  `;

  if (claimed.length === 0) {
    const existing = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        status: true,
        confirmationToken: true,
        razorpayPaymentId: true,
        stockDeducted: true,
        stockReserved: true
      }
    });
    if (
      existing &&
      (existing.status === "paid" ||
        existing.status === "processing" ||
        existing.status === "shipped" ||
        existing.status === "delivered")
    ) {
      if (paymentId && existing.razorpayPaymentId !== paymentId) {
        await db.order
          .update({
            where: { id: input.orderId },
            data: { razorpayPaymentId: paymentId }
          })
          .catch(() => undefined);
      }

      // Re-drive inventory and coupon burning if a prior attempt left paid-without-deduct.
      if (!existing.stockDeducted && existing.status === "paid") {
        const redriveRes = await fulfillOrderAtomic(input.orderId, `${input.source}:redrive`);
        if (!redriveRes.ok) {
          return { ok: false, confirmationToken: existing.confirmationToken };
        }
        // ITERATION 4 / HIGH-03 FIX: Only enqueue post-payment task when redriving an incomplete fulfillment,
        // rather than unconditionally on every webhook retry for an already-paid order.
        const { enqueuePostPaymentTask } = await import("@/modules/shop/services/outbox.service");
        await enqueuePostPaymentTask(input.orderId);
      }

      return { ok: true, confirmationToken: existing.confirmationToken, alreadyPaid: true };
    }
    logger.error(
      { orderId: input.orderId, status: existing?.status, source: input.source },
      "markOrderPaid could not claim order"
    );
    return { ok: false };
  }

  const fulfillmentRes = await fulfillOrderAtomic(input.orderId, input.source);
  if (!fulfillmentRes.ok) {
    return { ok: false, confirmationToken: fulfillmentRes.confirmationToken };
  }

  // ── Phase B: Enqueue async side-effects (P-03) ───────────────────────────
  // Customer attach, invoice PDF, confirmation email are deferred to the outbox.
  // This keeps the webhook/verify response fast (~100–500ms).

  const { enqueuePostPaymentTask } = await import("@/modules/shop/services/outbox.service");
  await enqueuePostPaymentTask(input.orderId);

  return { ok: true, confirmationToken: fulfillmentRes.confirmationToken };
}

export async function releaseCouponHold(couponCode: string | null | undefined) {
  if (!couponCode) return;
  // Coupons are only incremented on paid — nothing to decrement for abandoned pending.
}

/**
 * Records a failed payment attempt. Does NOT release stock reservation —
 * late capture can still succeed via markOrderPaid from payment_failed.
 * Stale reservations are released by releaseStalePendingOrders cron.
 */
export async function markOrderFailed(input: { orderId: string; source: string }): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: input.orderId }
  });
  if (
    !order ||
    order.status === "paid" ||
    order.status === "processing" ||
    order.status === "shipped" ||
    order.status === "delivered"
  ) {
    return;
  }

  await db.order.update({
    where: { id: order.id },
    data: { status: "payment_failed" }
  });

  const { recordOrderEvent } = await import("@/modules/shop/services/order-ops.service");
  await recordOrderEvent({
    orderId: order.id,
    type: "payment_failed",
    title: "Payment check failed",
    detail: input.source
  });
}

/**
 * Cron helper: releases stock holds for `pending` orders older than `maxAgeMinutes` where checkout was abandoned.
 */
export async function releaseStalePendingOrders(maxAgeMinutes = 45): Promise<{ releasedCount: number }> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await db.order.findMany({
    where: {
      status: { in: ["pending", "payment_failed"] },
      stockReserved: true,
      stockDeducted: false,
      createdAt: { lt: cutoff }
    },
    include: { items: true },
    take: 100
  });

  let count = 0;
  for (const o of stale) {
    await releaseReservationForOrder({
      orderId: o.id,
      lines: orderLines(o.items)
    });
    await db.order.update({
      where: { id: o.id },
      data: { status: "payment_failed", stockReserved: false }
    });
    await releaseCouponHold(o.couponCode);
    const { recordOrderEvent } = await import("@/modules/shop/services/order-ops.service");
    await recordOrderEvent({
      orderId: o.id,
      type: "order_timed_out",
      title: "Checkout timed out",
      detail: `Released reservation after ${maxAgeMinutes}m inactivity`
    });
    count += 1;
  }
  return { releasedCount: count };
}
