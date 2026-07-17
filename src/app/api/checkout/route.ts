import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createPendingOrder,
  markOrderFailed,
  markOrderPaid,
  priceCart
} from "@/modules/shop/services/order.service";
import { createRazorpayOrder, razorpayConfigured, razorpayPublicKey } from "@/lib/payments/razorpay";

import { featureEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev/test only: complete orders without opening Razorpay. */
function checkoutSkipPaymentEnabled() {
  const enabled = featureEnabled("checkout_skip_payment");
  if (enabled && process.env.NODE_ENV === "production") {
    logger.error(
      { event: "checkout_skip_payment_enabled_in_production" },
      "CRITICAL: CHECKOUT_SKIP_PAYMENT is enabled in production — disable before real traffic"
    );
  }
  return enabled;
}

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(20)
      })
    )
    .min(1)
    .max(50),
  address: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(20),
    email: z.string().trim().email().max(320),
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).optional().default(""),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(3).max(20),
    country: z.string().trim().min(2).max(100).optional().default("India")
  }),
  couponCode: z.string().trim().max(50).optional()
});

export async function POST(request: Request) {
  const skipPayment = checkoutSkipPaymentEnabled();

  if (!skipPayment && !razorpayConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Online payments are not configured yet. Please contact us to order." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please check your cart and address details." }, { status: 422 });
  }

  // P-08 / M-02 FIX: Checkout idempotency.
  // If client sends Idempotency-Key header, check for existing pending order with same key.
  // Prevents double-click creating two pending orders + two Razorpay orders.
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (idempotencyKey) {
    const existingOrder = await db.order.findFirst({
      where: {
        adminNotes: { contains: `[idem:${idempotencyKey}]` },
        status: { in: ["pending", "paid"] }
      },
      select: {
        id: true,
        orderNumber: true,
        confirmationToken: true,
        razorpayOrderId: true,
        totalCents: true,
        status: true
      }
    });
    if (existingOrder?.razorpayOrderId) {
      const priced = await priceCart(parsed.data.items, parsed.data.couponCode);
      return NextResponse.json({
        ok: true,
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        confirmationToken: existingOrder.confirmationToken,
        razorpayOrderId: existingOrder.razorpayOrderId,
        amountCents: existingOrder.totalCents,
        currency: "INR",
        keyId: razorpayPublicKey(),
        idempotent: true,
        cart: priced.ok ? priced.cart : undefined
      });
    }
  }

  const priced = await priceCart(parsed.data.items, parsed.data.couponCode);
  if (!priced.ok) {
    return NextResponse.json({ ok: false, error: priced.error }, { status: 409 });
  }

  const created = await createPendingOrder({ cart: priced.cart, address: parsed.data.address });
  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 409 });
  }

  // Stamp idempotency key on the order for future lookups.
  if (idempotencyKey) {
    await db.order
      .update({
        where: { id: created.orderId },
        data: {
          adminNotes: { set: `[idem:${idempotencyKey}]` }
        }
      })
      .catch(() => undefined);
  }

  if (skipPayment) {
    logger.warn(
      { event: "checkout_skip_payment", orderId: created.orderId, orderNumber: created.orderNumber },
      "CHECKOUT_SKIP_PAYMENT — marking order paid without Razorpay"
    );

    const paid = await markOrderPaid({
      orderId: created.orderId,
      razorpayPaymentId: `test_skip_${created.orderNumber}`,
      source: "test_skip"
    });

    if (!paid.ok) {
      await markOrderFailed({ orderId: created.orderId, source: "verify" }).catch(() => undefined);
      return NextResponse.json({ ok: false, error: "Could not complete test order." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      skipPayment: true,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      confirmationToken: created.confirmationToken,
      amountCents: priced.cart.totalCents,
      currency: "INR",
      cart: priced.cart,
      customer: {
        name: parsed.data.address.fullName,
        email: parsed.data.address.email,
        phone: parsed.data.address.phone
      }
    });
  }

  try {
    const rzpOrder = await createRazorpayOrder({
      amountCents: priced.cart.totalCents,
      receipt: created.orderNumber,
      notes: { orderId: created.orderId, orderNumber: created.orderNumber }
    });

    await db.order.update({
      where: { id: created.orderId },
      data: { razorpayOrderId: rzpOrder.id }
    });

    return NextResponse.json({
      ok: true,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      confirmationToken: created.confirmationToken,
      razorpayOrderId: rzpOrder.id,
      amountCents: priced.cart.totalCents,
      currency: "INR",
      keyId: razorpayPublicKey(),
      cart: priced.cart,
      customer: {
        name: parsed.data.address.fullName,
        email: parsed.data.address.email,
        phone: parsed.data.address.phone
      }
    });
  } catch (error) {
    logger.error({ err: error, event: "checkout_razorpay_failed", orderId: created.orderId }, "checkout failed");
    await markOrderFailed({ orderId: created.orderId, source: "checkout" }).catch(() => undefined);
    return NextResponse.json({ ok: false, error: "Could not start payment. Please try again." }, { status: 502 });
  }
}
