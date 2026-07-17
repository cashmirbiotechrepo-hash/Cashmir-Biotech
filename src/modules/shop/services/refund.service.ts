import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { restoreStockForOrder } from "@/modules/admin/services/inventory.service";
import { recordOrderEvent } from "@/modules/shop/services/order-ops.service";

const REFUNDABLE_STATUSES = ["paid", "processing", "shipped", "delivered", "partially_refunded"] as const;

export type ApplyOrderRefundInput = {
  orderId: string;
  razorpayRefundId: string;
  amountCents: number;
  source: "admin" | "webhook";
  /** Restore inventory on full refund (admin checkbox; webhook defaults true). */
  restock?: boolean;
  actorEmail?: string;
  reason?: string;
  eventType?: string;
};

export type ApplyOrderRefundResult =
  | { ok: true; applied: true; duplicate: false; fullyRefunded: boolean; newRefundedCents: number }
  | { ok: true; applied: false; duplicate: true; fullyRefunded: boolean; newRefundedCents: number }
  | { ok: false; error: string };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

function orderLines(
  items: Array<{ productId: string | null; quantity: number; productName: string }>
) {
  return items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    productName: i.productName
  }));
}

/**
 * Apply a Razorpay refund exactly once per `razorpayRefundId`.
 * Shared by admin refund action and refund.processed webhooks.
 */
export async function applyOrderRefund(input: ApplyOrderRefundInput): Promise<ApplyOrderRefundResult> {
  if (!input.razorpayRefundId || input.amountCents <= 0 || !Number.isInteger(input.amountCents)) {
    return { ok: false, error: "invalid_refund" };
  }

  let applied = false;
  let duplicate = false;
  let fullyRefunded = false;
  let newRefundedCents = 0;
  let restocked = false;

  try {
    const outcome = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${input.orderId} FOR UPDATE`;
        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: { items: true }
        });
        if (!order) {
          return { ok: false as const, error: "order_not_found" };
        }

        try {
          await tx.orderRefund.create({
            data: {
              orderId: input.orderId,
              razorpayRefundId: input.razorpayRefundId,
              amountCents: input.amountCents,
              source: input.source
            }
          });
          applied = true;
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          // PROJECT OMEGA / CRITICAL #2 & TOP-100 #3 FIX: Immediately return on duplicate refund P2002
          // Prevents execution fallthrough into aggregate / secondary inventory restoration (infinite stock inflation).
          return { ok: true as const, applied: false, duplicate: true, fullyRefunded: false, newRefundedCents: 0 };
        }

        const aggregate = await tx.orderRefund.aggregate({
          where: { orderId: input.orderId },
          _sum: { amountCents: true }
        });
        const totalRefunded = aggregate._sum.amountCents ?? 0;
        if (totalRefunded > order.totalCents) {
          throw new Error("refund_exceeds_order_total");
        }

        const isFullyRefunded = totalRefunded >= order.totalCents;
        const newStatus = isFullyRefunded ? "refunded" : "partially_refunded";
        const statusUpdate: Prisma.OrderUpdateInput =
          REFUNDABLE_STATUSES.includes(order.status as (typeof REFUNDABLE_STATUSES)[number])
            ? { status: newStatus }
            : {};
        const shouldRestock = (input.restock ?? true) && isFullyRefunded && order.stockDeducted;

        if (shouldRestock) {
          await restoreStockForOrder({
            orderId: order.id,
            lines: orderLines(order.items),
            changeType: "order_returned",
            createdBy: input.actorEmail ?? `refund:${input.source}`,
            tx
          });
          restocked = true;
        }

        // PROJECT OMEGA / MEDIUM #1 & TOP-100 #7 FIX: Decrement Coupon.usedCount on full refund/cancellation
        if (isFullyRefunded && order.couponCode) {
          await tx.coupon.updateMany({
            where: { code: order.couponCode, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } }
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            refundedCents: totalRefunded,
            ...(shouldRestock ? { stockDeducted: false } : {}),
            ...statusUpdate
          }
        });

        if (restocked) {
          await tx.orderRefund.update({
            where: { razorpayRefundId: input.razorpayRefundId },
            data: { stockRestored: true }
          });
        }

        return {
          ok: true as const,
          fullyRefunded: isFullyRefunded,
          newRefundedCents: totalRefunded
        };
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000
      }
    );

    if (!outcome.ok) return outcome;
    fullyRefunded = outcome.fullyRefunded;
    newRefundedCents = outcome.newRefundedCents;
  } catch (err) {
    logger.error(
      { err, event: "order_refund_apply_failed", orderId: input.orderId, refundId: input.razorpayRefundId },
      "refund apply failed"
    );
    return { ok: false, error: err instanceof Error ? err.message : "refund_apply_failed" };
  }

  const title = fullyRefunded ? "Full refund applied" : "Partial refund applied";
  const detail = `₹${(input.amountCents / 100).toFixed(2)} refunded (total: ₹${(newRefundedCents / 100).toFixed(2)})`;

  if (applied) {
    await recordOrderEvent({
      orderId: input.orderId,
      type: input.eventType ?? (input.source === "admin" ? "refund_issued" : "refund_processed"),
      title,
      detail: input.reason ? `${detail} · ${input.reason}` : detail,
      actorEmail: input.actorEmail,
      metadata: {
        refundId: input.razorpayRefundId,
        amountCents: input.amountCents,
        refundedCents: newRefundedCents,
        restock: restocked,
        fullyRefunded,
        source: input.source
      }
    });
  }

  logger.info(
    {
      event: "order_refund_applied",
      orderId: input.orderId,
      refundId: input.razorpayRefundId,
      amountCents: input.amountCents,
      newRefundedCents,
      fullyRefunded,
      source: input.source,
      duplicate,
      restocked
    },
    "refund applied"
  );

  if (duplicate) {
    return {
      ok: true,
      applied: false,
      duplicate: true,
      fullyRefunded,
      newRefundedCents
    };
  }

  return {
    ok: true,
    applied: true,
    duplicate: false,
    fullyRefunded,
    newRefundedCents
  };
}
