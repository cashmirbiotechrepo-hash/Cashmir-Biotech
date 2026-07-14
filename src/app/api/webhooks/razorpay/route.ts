import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { markOrderFailed, markOrderPaid } from "@/modules/shop/services/order.service";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string } };
    refund?: { entity?: { id?: string } };
  };
};

async function findOrderByRazorpayOrderId(razorpayOrderId: string | undefined) {
  if (!razorpayOrderId) return null;
  return db.order.findFirst({ where: { razorpayOrderId } });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    logger.warn({ event: "razorpay_webhook_bad_signature" }, "rejected razorpay webhook with invalid signature");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(raw) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = event.event ?? "unknown";
  const paymentEntity = event.payload?.payment?.entity;
  const eventId =
    request.headers.get("x-razorpay-event-id") ||
    `${eventType}:${paymentEntity?.id ?? event.payload?.refund?.entity?.id ?? crypto.randomUUID()}`;

  const order = await findOrderByRazorpayOrderId(paymentEntity?.order_id);

  // Idempotency: the unique providerEventId means a replayed webhook is recorded once and skipped.
  try {
    await db.paymentEvent.create({
      data: {
        eventType,
        providerEventId: eventId,
        orderId: order?.id ?? null,
        signatureValid: true,
        payload: event as unknown as object
      }
    });
  } catch {
    // Duplicate delivery — already processed this exact event.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (order) {
    if (eventType === "payment.captured" || eventType === "order.paid") {
      try {
        const paid = await markOrderPaid({
          orderId: order.id,
          razorpayPaymentId: paymentEntity?.id,
          source: "webhook"
        });
        if (!paid.ok) {
          logger.error(
            { orderId: order.id, eventType, event: "webhook_fulfillment_failed" },
            "webhook capture acknowledged but fulfillment failed"
          );
          // 500 so Razorpay retries; idempotent claim prevents double side-effects.
          return NextResponse.json({ ok: false, retry: true }, { status: 500 });
        }
      } catch (err) {
        logger.error({ err, orderId: order.id, event: "webhook_fulfillment_error" }, "markOrderPaid threw");
        return NextResponse.json({ ok: false, retry: true }, { status: 500 });
      }
    } else if (eventType === "payment.failed") {
      // Keep stock reserved for late capture; stale-order cron releases holds.
      await markOrderFailed({ orderId: order.id, source: "webhook" });
    }
  } else {
    logger.warn({ event: "razorpay_webhook_no_order", eventType }, "webhook received for unknown order");
  }

  return NextResponse.json({ ok: true });
}
