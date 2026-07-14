import "server-only";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendAdminMail } from "@/lib/admin/mail";
import {
  deductStockForOrder,
  releaseReservationForOrder,
  reserveStockForOrder,
  type StockLine
} from "@/modules/admin/services/inventory.service";

/** Free shipping at/above this order subtotal (in paise), otherwise a flat fee applies. */
const FREE_SHIPPING_THRESHOLD_CENTS = 99900; // ₹999
const FLAT_SHIPPING_CENTS = 6000; // ₹60
/** MRP prices are GST-inclusive, so tax is not added on top. */
const TAX_CENTS = 0;

export const MAX_QTY_PER_ITEM = 20;

export type CartInputItem = { productId: string; quantity: number };

export type PricedLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
};

export type PriceResult = { ok: true; cart: PricedCart } | { ok: false; error: string };

/**
 * Re-validates a cart entirely from the DB: product existence, active flag, quantity bounds, and price.
 * The client only supplies product IDs + quantities — never prices or totals.
 */
export async function priceCart(items: CartInputItem[]): Promise<PriceResult> {
  const clean = new Map<string, number>();
  for (const item of items) {
    if (!item?.productId || typeof item.quantity !== "number") continue;
    const qty = Math.floor(item.quantity);
    if (qty < 1) continue;
    clean.set(item.productId, Math.min(MAX_QTY_PER_ITEM, (clean.get(item.productId) ?? 0) + qty));
  }
  if (clean.size === 0) return { ok: false, error: "Your cart is empty." };

  const products = await db.product.findMany({
    where: { id: { in: [...clean.keys()] }, active: true }
  });

  const lines: PricedLine[] = [];
  for (const [productId, quantity] of clean) {
    const product = products.find((p) => p.id === productId);
    if (!product) return { ok: false, error: "One or more items are no longer available." };
    const unitPriceCents = product.mrpInr * 100;
    lines.push({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
  const totalCents = subtotalCents + TAX_CENTS + shippingCents;

  return {
    ok: true,
    cart: { lines, subtotalCents, taxCents: TAX_CENTS, shippingCents, totalCents }
  };
}

/** Human-facing, non-sequential order reference. */
export function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `CB-${ymd}-${rand}`;
}

type ShippingAddress = {
  fullName: string;
  phone: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/**
 * Creates a `pending` order with priced items and reserves stock atomically.
 * Returns the created order, or an error if stock can't be reserved.
 */
export async function createPendingOrder(input: {
  cart: PricedCart;
  address: ShippingAddress;
}): Promise<{ ok: true; orderId: string; orderNumber: string } | { ok: false; error: string }> {
  const { cart, address } = input;
  const orderNumber = generateOrderNumber();

  const normalizedEmail = address.email.toLowerCase().trim();

  const order = await db.order.create({
    data: {
      orderNumber,
      customerEmail: normalizedEmail,
      customerName: address.fullName,
      customerPhone: address.phone,
      status: "pending",
      subtotalCents: cart.subtotalCents,
      taxCents: cart.taxCents,
      shippingCents: cart.shippingCents,
      totalCents: cart.totalCents,
      shippingAddress: address as unknown as Prisma.InputJsonValue,
      items: {
        create: cart.lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents
        }))
      }
    }
  });

  const lines: StockLine[] = cart.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    productName: l.productName
  }));

  const reservation = await reserveStockForOrder({ orderId: order.id, lines });
  if (!reservation.ok) {
    // Couldn't secure stock — void the order immediately so it never blocks anything.
    await db.order.update({ where: { id: order.id }, data: { status: "payment_failed" } }).catch(() => undefined);
    return { ok: false, error: reservation.error };
  }

  await db.order.update({ where: { id: order.id }, data: { stockReserved: true } });

  const { recordOrderEvent } = await import("@/modules/shop/services/order-ops.service");
  await recordOrderEvent({
    orderId: order.id,
    type: "order_created",
    title: "Order created",
    detail: orderNumber
  });
  await recordOrderEvent({
    orderId: order.id,
    type: "inventory_reserved",
    title: "Inventory reserved",
    detail: `${cart.lines.reduce((n, l) => n + l.quantity, 0)} unit(s) held pending payment`
  });

  return { ok: true, orderId: order.id, orderNumber };
}

function orderLines(items: { productId: string | null; quantity: number; productName: string }[]): StockLine[] {
  return items.map((i) => ({ productId: i.productId, quantity: i.quantity, productName: i.productName }));
}

/**
 * Marks an order paid: converts the reservation into an actual deduction and sends confirmation.
 * Idempotent — safe to call from both the verify endpoint and the webhook.
 */
export async function markOrderPaid(input: {
  orderId: string;
  razorpayPaymentId?: string;
  source: "verify" | "webhook" | "test_skip";
}): Promise<{ ok: boolean }> {
  const order = await db.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
  if (!order) return { ok: false };

  // Already finalized — nothing to do (idempotency guard).
  if (order.status === "paid" || order.stockDeducted) {
    if (input.razorpayPaymentId && !order.razorpayPaymentId) {
      await db.order.update({
        where: { id: order.id },
        data: { razorpayPaymentId: input.razorpayPaymentId }
      });
    }
    return { ok: true };
  }

  await deductStockForOrder({
    orderId: order.id,
    lines: orderLines(order.items),
    releaseReserved: order.stockReserved,
    createdBy: `payment:${input.source}`
  });

  await db.order.update({
    where: { id: order.id },
    data: {
      status: "paid",
      stockDeducted: true,
      stockReserved: false,
      ...(input.razorpayPaymentId ? { razorpayPaymentId: input.razorpayPaymentId } : {})
    }
  });

  logger.info({ event: "order_paid", orderId: order.id, source: input.source }, "order marked paid");

  // Research Portal: create/update Customer record and attach this order (no password yet).
  // Historical guest orders stay unlinked until the inbox is proven via OTP — unless already verified.
  if (order.customerEmail) {
    try {
      const {
        ensureCustomerFromCheckout,
        attachOrderToCustomer,
        linkGuestOrdersToCustomer
      } = await import("@/lib/customer/auth");
      const customerId = await ensureCustomerFromCheckout({
        email: order.customerEmail,
        name: order.customerName,
        phone: order.customerPhone
      });
      if (customerId) {
        await attachOrderToCustomer(order.id, customerId);
        const verified = await db.customer.findUnique({
          where: { id: customerId },
          select: { emailVerifiedAt: true }
        });
        if (verified?.emailVerifiedAt) {
          await linkGuestOrdersToCustomer(customerId, order.customerEmail);
        }
      }
    } catch (err) {
      logger.error({ err, orderId: order.id, event: "customer_attach_failed" }, "failed to attach order to customer");
    }
  }

  const { runPaidOrderAutomation } = await import("@/modules/shop/services/order-ops.service");
  await runPaidOrderAutomation(order.id, input.source).catch(() => undefined);
  await sendOrderConfirmation(order.id).catch(() => undefined);
  return { ok: true };
}

/** Marks an order failed and releases any reservation it was holding. Idempotent. */
export async function markOrderFailed(input: {
  orderId: string;
  source: "verify" | "webhook" | "cron";
}) {
  const order = await db.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
  if (!order) return;
  if (order.status === "paid" || order.stockDeducted) return; // never downgrade a paid order

  if (order.stockReserved) {
    await releaseReservationForOrder({ orderId: order.id, lines: orderLines(order.items) });
  }
  await db.order.update({
    where: { id: order.id },
    data: { status: "payment_failed", stockReserved: false }
  });
  logger.info({ event: "order_failed", orderId: order.id, source: input.source }, "order marked payment_failed");

  const { recordOrderEvent } = await import("@/modules/shop/services/order-ops.service");
  await recordOrderEvent({
    orderId: order.id,
    type: "payment_failed",
    title: "Payment failed / abandoned",
    detail: `Source: ${input.source} — reservation released`
  });
}

/**
 * Releases stock held by abandoned Razorpay checkouts (customer closed the modal,
 * network drop, etc.). Safe to run on a schedule — only touches `pending` orders
 * older than `maxAgeMinutes` that still have a reservation.
 */
export async function releaseStalePendingOrders(maxAgeMinutes = 45) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await db.order.findMany({
    where: {
      status: "pending",
      stockReserved: true,
      createdAt: { lt: cutoff }
    },
    select: { id: true, orderNumber: true }
  });

  let released = 0;
  for (const order of stale) {
    await markOrderFailed({ orderId: order.id, source: "cron" });
    released += 1;
  }

  if (released > 0) {
    logger.info(
      { event: "stale_orders_released", count: released, maxAgeMinutes },
      "released stock from abandoned pending orders"
    );
  }

  return { scanned: stale.length, released };
}

/** Public-safe order summary for the confirmation page (looked up by the hard-to-guess order number). */
export async function getOrderSummaryByNumber(orderNumber: string) {
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true }
  });
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents
    }))
  };
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

async function sendOrderConfirmation(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order?.customerEmail) return;

  const itemLines = order.items
    .map((i) => `  ${i.quantity} × ${i.productName} — ${inr.format((i.unitPriceCents * i.quantity) / 100)}`)
    .join("\n");

  const body = [
    `Hi ${order.customerName ?? "there"},`,
    "",
    `Thank you for your order! We've received your payment and are getting it ready.`,
    "",
    `Order reference: ${order.orderNumber}`,
    "",
    "Items:",
    itemLines,
    "",
    `Subtotal: ${inr.format(order.subtotalCents / 100)}`,
    `Shipping: ${order.shippingCents === 0 ? "Free" : inr.format(order.shippingCents / 100)}`,
    `Total paid: ${inr.format(order.totalCents / 100)}`,
    "",
    "We'll email you again when it ships.",
    "",
    "Track formulations and documents in your Research Portal:",
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://cashmirbiotech.com"}/portal/login?email=${encodeURIComponent(order.customerEmail)}`,
    "",
    "— Cashmir Biotech"
  ].join("\n");

  await sendAdminMail({ to: order.customerEmail, subject: `Order confirmed · ${order.orderNumber}`, text: body });
}
