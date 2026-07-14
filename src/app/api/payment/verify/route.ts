import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { markOrderPaid } from "@/modules/shop/services/order.service";
import { assertCapturedPayment, verifyPaymentSignature } from "@/lib/payments/razorpay";

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
      "razorpay signature verification failed — order left unchanged"
    );
    return NextResponse.json({ ok: false, error: "Payment could not be verified." }, { status: 400 });
  }

  const captured = await assertCapturedPayment({
    paymentId: razorpayPaymentId,
    razorpayOrderId,
    amountCents: order.totalCents
  });
  if (!captured.ok) {
    logger.warn(
      { event: "payment_assert_failed", orderId: order.id, error: captured.error },
      "Razorpay payment assertion failed"
    );
    return NextResponse.json({ ok: false, error: captured.error }, { status: 400 });
  }

  let paid: { ok: boolean; confirmationToken?: string };
  try {
    paid = await markOrderPaid({ orderId: order.id, razorpayPaymentId, source: "verify" });
  } catch (err) {
    logger.error({ err, orderId: order.id, event: "payment_verify_fulfillment_error" }, "markOrderPaid threw");
    return NextResponse.json(
      { ok: false, error: "Payment captured but fulfillment failed. Support has been notified.", needsSupport: true },
      { status: 500 }
    );
  }

  if (!paid.ok) {
    logger.error(
      { orderId: order.id, razorpayPaymentId, event: "payment_verify_fulfillment_failed" },
      "signature valid but fulfillment failed"
    );
    await db.paymentEvent
      .create({
        data: {
          eventType: "verify.fulfillment_failed",
          providerEventId: `verify-fulfill:${razorpayPaymentId}:${Date.now()}`,
          orderId: order.id,
          signatureValid: true,
          payload: { razorpayOrderId, razorpayPaymentId }
        }
      })
      .catch(() => undefined);
    return NextResponse.json(
      {
        ok: false,
        error: "Payment was received but we could not complete your order. Please contact support.",
        needsSupport: true,
        orderNumber: order.orderNumber
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    orderNumber: order.orderNumber,
    confirmationToken: paid.confirmationToken ?? order.confirmationToken
  });
}
