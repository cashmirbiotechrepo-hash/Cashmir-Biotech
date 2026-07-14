import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { markOrderFailed, markOrderPaid } from "@/modules/shop/services/order.service";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1)
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Missing payment details." }, { status: 422 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  const order = await db.order.findFirst({ where: { razorpayOrderId } });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const valid = verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature: razorpaySignature });

  // Audit trail: log every verify attempt, deduped by payment id.
  await db.paymentEvent
    .create({
      data: {
        eventType: valid ? "verify.success" : "verify.invalid_signature",
        providerEventId: `verify:${razorpayPaymentId}`,
        orderId: order.id,
        signatureValid: valid,
        payload: { razorpayOrderId, razorpayPaymentId }
      }
    })
    .catch(() => undefined);

  if (!valid) {
    logger.warn(
      { event: "payment_signature_invalid", orderId: order.id, razorpayOrderId },
      "razorpay signature verification failed"
    );
    await markOrderFailed({ orderId: order.id, source: "verify" }).catch(() => undefined);
    return NextResponse.json({ ok: false, error: "Payment could not be verified." }, { status: 400 });
  }

  await markOrderPaid({ orderId: order.id, razorpayPaymentId, source: "verify" });

  return NextResponse.json({ ok: true, orderNumber: order.orderNumber });
}
