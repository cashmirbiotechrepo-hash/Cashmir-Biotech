import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createPendingOrder,
  markOrderFailed,
  priceCart
} from "@/modules/shop/services/order.service";
import { createRazorpayOrder, razorpayConfigured, razorpayPublicKey } from "@/lib/payments/razorpay";
import { requireJsonContent } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  couponCode: z.string().optional().nullable(),
  address: z.object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().min(10).max(20),
    line1: z.string().min(3).max(160),
    line2: z.string().optional().default(""),
    city: z.string().min(2).max(80),
    state: z.string().min(2).max(80),
    postalCode: z.string().min(4).max(12),
    country: z.string().default("India")
  })
});

const FINAL_ORDER_STATUSES = ["paid", "processing", "shipped", "delivered", "refunded", "partially_refunded"] as const;

function readIdempotencyKey(request: Request): string | { error: string } | null {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return null;
  // PROJECT OMEGA / MED-02 FIX: Reject oversized keys immediately instead of hashing/slicing
  if (key.length > 100) {
    return { error: "Idempotency key exceeds maximum allowed length of 100 characters." };
  }
  return key;
}

function cartFromOrder(order: {
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  discountCents: number | null;
  couponCode: string | null;
  items: Array<{
    productId: string | null;
    productName: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}) {
  return {
    subtotal: order.subtotalCents,
    tax: order.taxCents,
    shipping: order.shippingCents,
    total: order.totalCents,
    discount: order.discountCents ?? 0,
    couponCode: order.couponCode ?? undefined,
    items: order.items.map((item) => ({
      productId: item.productId ?? "unknown",
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents
    }))
  };
}

async function responseForExistingOrder(input: {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    razorpayOrderId: string | null;
    confirmationToken: string;
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    discountCents: number | null;
    couponCode: string | null;
    items: Array<{
      productId: string | null;
      productName: string;
      quantity: number;
      unitPriceCents: number;
    }>;
  } | null;
}) {
  const order = input.order;
  if (!order) return null;

  if (FINAL_ORDER_STATUSES.includes(order.status as (typeof FINAL_ORDER_STATUSES)[number])) {
    return NextResponse.json({
      ok: true,
      alreadyPaid: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents: order.totalCents,
      currency: "INR",
      cart: cartFromOrder(order)
    });
  }

  let razorpayOrderId = order.razorpayOrderId;
  if (!razorpayOrderId) {
    const rzpOrder = await createRazorpayOrder({
      amountCents: order.totalCents,
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber }
    });
    razorpayOrderId = rzpOrder.id;
    await db.order.update({
      where: { id: order.id },
      data: { razorpayOrderId }
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    razorpayOrderId,
    amountCents: order.totalCents,
    currency: "INR",
    keyId: razorpayPublicKey(),
    idempotent: true,
    cart: cartFromOrder(order)
  });
}

function findOrderByIdempotencyKey(idempotencyKey: string) {
  return db.order.findUnique({
    where: { idempotencyKey },
    include: { items: true }
  });
}

export async function POST(request: Request) {
  const invalidType = requireJsonContent(request);
  if (invalidType) return invalidType;

  if (!razorpayConfigured()) {
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

  const idKeyResult = readIdempotencyKey(request);
  if (idKeyResult && typeof idKeyResult === "object" && "error" in idKeyResult) {
    return NextResponse.json({ ok: false, error: idKeyResult.error }, { status: 400 });
  }
  const idempotencyKey = idKeyResult as string | null;

  if (idempotencyKey) {
    const existingOrder = await findOrderByIdempotencyKey(idempotencyKey);
    const existingResponse = await responseForExistingOrder({ order: existingOrder });
    if (existingResponse) return existingResponse;
  }

  const priced = await priceCart(parsed.data.items, parsed.data.couponCode ?? undefined);
  if (!priced.ok) {
    return NextResponse.json({ ok: false, error: priced.error }, { status: 409 });
  }

  const created = await createPendingOrder({
    cart: priced.cart,
    address: parsed.data.address,
    idempotencyKey
  });
  if (!created.ok) {
    if (idempotencyKey) {
      const existingOrder = await findOrderByIdempotencyKey(idempotencyKey);
      const existingResponse = await responseForExistingOrder({ order: existingOrder });
      if (existingResponse) return existingResponse;
    }
    return NextResponse.json({ ok: false, error: created.error }, { status: 409 });
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
