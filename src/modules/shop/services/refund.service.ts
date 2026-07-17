import "server-only";
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

/**
 * Apply a Razorpay refund exactly once per `razorpayRefundId`.
 * Shared by admin refund action and refund.processed webhooks.
 */
export async function applyOrderRefund(input: ApplyOrderRefundInput): Promise<ApplyOrderRefundResult> {
  if (!input.razorpayRefundId || input.amountCents <= 0) {
    return { ok: false, error: "invalid_refund" };
  }

  try {
    await db.orderRefund.create({
      data: {
        orderId: input.orderId,
        razorpayRefundId: input.razorpayRefundId,
        amountCents: input.amountCents,
        source: input.source
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const order = await db.order.findUnique({
        where: { id: input.orderId },
        select: { refundedCents: true, totalCents: true }
      });
      const newRefundedCents = order?.refundedCents ?? 0;
      return {
        ok: true,
        applied: false,
        duplicate: true,
        fullyRefunded: newRefundedCents >= (order?.totalCents ?? 0),
        newRefundedCents
      };
    }
    throw err;
  }

  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { items: true }
  });
  if (!order) {
    return { ok: false, error: "order_not_found" };
  }

  const newRefundedCents = (order.refundedCents ?? 0) + input.amountCents;
  const fullyRefunded = newRefundedCents >= order.totalCents;
  const newStatus = fullyRefunded ? "refunded" : "partially_refunded";
  const shouldRestock = (input.restock ?? true) && fullyRefunded;

  const statusUpdate =
    REFUNDABLE_STATUSES.includes(order.status as (typeof REFUNDABLE_STATUSES)[number])
      ? { status: newStatus as typeof order.status }
      : {};

  if (shouldRestock && order.stockDeducted) {
    const cleared = await db.order.updateMany({
      where: { id: order.id, stockDeducted: true },
      data: {
        refundedCents: newRefundedCents,
        stockDeducted: false,
        ...statusUpdate
      }
    });

    if (cleared.count === 1) {
      await restoreStockForOrder({
        orderId: order.id,
        lines: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          productName: i.productName
        })),
        changeType: "order_returned",
        createdBy: input.actorEmail ?? `refund:${input.source}`
      });
      await db.orderRefund
        .update({
          where: { razorpayRefundId: input.razorpayRefundId },
          data: { stockRestored: true }
        })
        .catch(() => undefined);
    } else {
      await db.order.update({
        where: { id: order.id },
        data: { refundedCents: newRefundedCents, ...statusUpdate }
      });
    }
  } else {
    await db.order.update({
      where: { id: order.id },
      data: { refundedCents: newRefundedCents, ...statusUpdate }
    });
  }

  const title = fullyRefunded ? "Full refund applied" : "Partial refund applied";
  const detail = `₹${(input.amountCents / 100).toFixed(2)} refunded (total: ₹${(newRefundedCents / 100).toFixed(2)})`;

  await recordOrderEvent({
    orderId: order.id,
    type: input.eventType ?? (input.source === "admin" ? "refund_issued" : "refund_processed"),
    title,
    detail: input.reason ? `${detail} · ${input.reason}` : detail,
    actorEmail: input.actorEmail,
    metadata: {
      refundId: input.razorpayRefundId,
      amountCents: input.amountCents,
      refundedCents: newRefundedCents,
      restock: shouldRestock,
      fullyRefunded,
      source: input.source
    }
  });

  logger.info(
    {
      event: "order_refund_applied",
      orderId: order.id,
      refundId: input.razorpayRefundId,
      amountCents: input.amountCents,
      newRefundedCents,
      fullyRefunded,
      source: input.source
    },
    "refund applied"
  );

  return {
    ok: true,
    applied: true,
    duplicate: false,
    fullyRefunded,
    newRefundedCents
  };
}
