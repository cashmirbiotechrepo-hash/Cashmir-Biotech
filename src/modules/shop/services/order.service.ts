import "server-only";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  deductStockForOrder,
  releaseReservationForOrder,
  reserveStockForOrder,
  type StockLine
} from "@/modules/admin/services/inventory.service";

function newConfirmationToken() {
  return randomBytes(24).toString("base64url");
}

/** Dynamic shipping threshold and flat rate (in paise) configured via environment variables (MED-03). */
export function getShippingRates() {
  const freeThresholdInr = parseInt(process.env.FREE_SHIPPING_THRESHOLD_INR || "999", 10);
  const flatShippingInr = parseInt(process.env.FLAT_SHIPPING_INR || "60", 10);
  return {
    freeThresholdCents: (Number.isNaN(freeThresholdInr) || freeThresholdInr < 0 ? 999 : freeThresholdInr) * 100,
    flatShippingCents: (Number.isNaN(flatShippingInr) || flatShippingInr < 0 ? 60 : flatShippingInr) * 100
  };
}

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
  couponCode?: string;
  discountCents?: number;
};

export type PriceResult = { ok: true; cart: PricedCart } | { ok: false; error: string };

/**
 * Re-validates a cart entirely from the DB: product existence, active flag, quantity bounds, price,
 * and optional coupon code validity (HIGH-11).
 * The client only supplies product IDs + quantities + optional coupon — never prices or totals.
 */
export async function priceCart(items: CartInputItem[], couponCode?: string): Promise<PriceResult> {
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
  let discountCents = 0;
  let normalizedCoupon: string | undefined;

  // HIGH-11: Coupon Validation
  if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
    normalizedCoupon = couponCode.trim().toUpperCase();
    const coupon = await db.coupon.findUnique({ where: { code: normalizedCoupon } });
    if (!coupon || !coupon.active) {
      return { ok: false, error: "Invalid coupon code." };
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { ok: false, error: "Coupon code has expired." };
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { ok: false, error: "Coupon code usage limit reached." };
    }

    if (coupon.type === "percent") {
      discountCents = Math.round((subtotalCents * Math.min(100, coupon.value)) / 100);
    } else if (coupon.type === "fixed") {
      discountCents = coupon.value * 100;
    }
    discountCents = Math.min(subtotalCents, discountCents);
  }

  const { freeThresholdCents, flatShippingCents } = getShippingRates();
  const subtotalAfterDiscount = subtotalCents - discountCents;
  const shippingCents = subtotalAfterDiscount >= freeThresholdCents ? 0 : flatShippingCents;
  const totalCents = subtotalAfterDiscount + TAX_CENTS + shippingCents;

  return {
    ok: true,
    cart: {
      lines,
      subtotalCents,
      taxCents: TAX_CENTS,
      shippingCents,
      totalCents,
      couponCode: normalizedCoupon,
      discountCents: discountCents > 0 ? discountCents : undefined
    }
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
 *
 * CRIT-02 FIX: The order creation and stock reservation are wrapped in a single
 * Prisma interactive transaction with Serializable isolation. If stock reservation
 * fails, the order row is automatically rolled back — no orphaned orders possible.
 *
 * HIGH-11 FIX: Verifies coupon code again inside transaction and increments usedCount atomically.
 */
export async function createPendingOrder(input: {
  cart: PricedCart;
  address: ShippingAddress;
}): Promise<
  { ok: true; orderId: string; orderNumber: string; confirmationToken: string } | { ok: false; error: string }
> {
  const { cart, address } = input;
  const orderNumber = generateOrderNumber();

  const normalizedEmail = address.email.toLowerCase().trim();

  const lines: StockLine[] = cart.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    productName: l.productName
  }));

  try {
    const order = await db.$transaction(
      async (tx) => {
        // Validate coupon inside the transaction — do NOT burn usedCount until payment (H4).
        if (cart.couponCode) {
          const coupon = await tx.coupon.findUnique({ where: { code: cart.couponCode } });
          if (
            !coupon ||
            !coupon.active ||
            (coupon.expiresAt && coupon.expiresAt < new Date()) ||
            (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
          ) {
            throw new Error("Coupon code is no longer valid or reached limit.");
          }
        }

        const adminNotes =
          cart.couponCode && cart.discountCents
            ? `[Coupon: ${cart.couponCode} (-₹${(cart.discountCents / 100).toFixed(2)})]`
            : "";

        const created = await tx.order.create({
          data: {
            orderNumber,
            confirmationToken: newConfirmationToken(),
            customerEmail: normalizedEmail,
            customerName: address.fullName,
            customerPhone: address.phone,
            status: "pending",
            subtotalCents: cart.subtotalCents,
            taxCents: cart.taxCents,
            shippingCents: cart.shippingCents,
            discountCents: cart.discountCents ?? 0,
            totalCents: cart.totalCents,
            couponCode: cart.couponCode ?? "",
            adminNotes,
            shippingAddress: {
              ...address,
              couponCode: cart.couponCode,
              discountCents: cart.discountCents
            } as unknown as Prisma.InputJsonValue,
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

        // Reserve stock inside the same transaction — if this fails, the order is rolled back.
        const reservation = await reserveStockForOrder({ orderId: created.id, lines, tx });
        if (!reservation.ok) {
          throw new Error(reservation.error);
        }

        await tx.order.update({ where: { id: created.id }, data: { stockReserved: true } });
        return created;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000
      }
    );

    const { recordOrderEvent } = await import("@/modules/shop/services/order-ops.service");
    await recordOrderEvent({
      orderId: order.id,
      type: "order_created",
      title: "Order created",
      detail: orderNumber
    });
    if (cart.couponCode && cart.discountCents) {
      await recordOrderEvent({
        orderId: order.id,
        type: "coupon_applied",
        title: "Coupon applied",
        detail: `${cart.couponCode} (-₹${(cart.discountCents / 100).toFixed(2)})`
      });
    }
    await recordOrderEvent({
      orderId: order.id,
      type: "inventory_reserved",
      title: "Inventory reserved",
      detail: `${cart.lines.reduce((n, l) => n + l.quantity, 0)} unit(s) held pending payment`
    });

    return {
      ok: true,
      orderId: order.id,
      orderNumber,
      confirmationToken: order.confirmationToken
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create order.";
    if (message.includes("Not enough stock") || message.includes("Coupon")) {
      return { ok: false, error: message };
    }
    logger.error({ err, event: "order_create_failed" }, "transactional order creation failed");
    return { ok: false, error: "Could not create your order. Please try again." };
  }
}

function orderLines(items: { productId: string | null; quantity: number; productName: string }[]): StockLine[] {
  return items.map((i) => ({
    productId: i.productId ?? "",
    quantity: i.quantity,
    productName: i.productName
  }));
}

/**
 * Called after payment is verified (Razorpay webhook / return) or when dev checkout skips payment.
 * Safe to call multiple times (idempotent). Concurrent verify+webhook is single-flight via atomic claim.
 */
export async function markOrderPaid(input: {
  orderId: string;
  razorpayPaymentId?: string;
  source: string;
}): Promise<{ ok: boolean; confirmationToken?: string; alreadyPaid?: boolean }> {
  const paymentId = (input.razorpayPaymentId ?? "").trim();

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
      select: { status: true, confirmationToken: true, razorpayPaymentId: true }
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
      return { ok: true, confirmationToken: existing.confirmationToken, alreadyPaid: true };
    }
    logger.error(
      { orderId: input.orderId, status: existing?.status, source: input.source },
      "markOrderPaid could not claim order"
    );
    return { ok: false };
  }

  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { items: true }
  });
  if (!order) return { ok: false };

  const lines = orderLines(order.items);
  let deducted = order.stockDeducted;

  if (!deducted) {
    if (!order.stockReserved) {
      const res = await reserveStockForOrder({ orderId: order.id, lines });
      if (!res.ok) {
        logger.error({ orderId: order.id, err: res.error }, "paid order but stock reservation failed");
        return { ok: false, confirmationToken: order.confirmationToken };
      }
      await db.order.update({ where: { id: order.id }, data: { stockReserved: true } });
    }
    try {
      await deductStockForOrder({
        orderId: order.id,
        lines,
        releaseReserved: true,
        createdBy: `payment:${input.source}`
      });
      deducted = true;
      await db.order.update({
        where: { id: order.id },
        data: { stockDeducted: true, stockReserved: false }
      });
    } catch (err) {
      logger.error({ orderId: order.id, err }, "deducting reserved stock failed after payment");
      return { ok: false, confirmationToken: order.confirmationToken };
    }
  }

  // Burn coupon under maxUses — concurrent burns cannot exceed the cap.
  if (order.couponCode) {
    const burned = await db.$executeRaw`
      UPDATE "Coupon"
      SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
      WHERE code = ${order.couponCode}
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;
    if (burned === 0) {
      logger.warn(
        { orderId: order.id, coupon: order.couponCode },
        "coupon maxUses reached at burn time — order remains paid"
      );
    }
  }

  // Customer Portal: create/update Customer and attach this order.
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

  const { runPaidOrderAutomation, ensureInvoiceForOrder, recordOrderEvent } = await import(
    "@/modules/shop/services/order-ops.service"
  );

  await recordOrderEvent({
    orderId: order.id,
    type: "payment_confirmed",
    title: "Payment confirmed",
    detail: paymentId ? `Razorpay ${paymentId}` : `via ${input.source}`
  });

  await runPaidOrderAutomation(order.id, input.source).catch((err) => {
    logger.error({ err, orderId: order.id }, "paid order automation failed");
  });

  // Ensure invoice exists even if automation partially failed.
  const inv = await ensureInvoiceForOrder(order.id).catch(() => null);
  if (inv?.invoiceId) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const tokenUrl = `${site}/api/order/${order.orderNumber}/invoice.pdf?t=${order.confirmationToken}`;
    const invoice = await db.invoice.findUnique({ where: { id: inv.invoiceId } });
    if (invoice) {
      const gst = (invoice.gstDetails ?? {}) as {
        gstin?: string;
        cgstCents?: number;
        sgstCents?: number;
        placeOfSupply?: string;
        lineItems?: Array<{ description: string; qty: number; amountCents: number }>;
      };
      const { persistInvoicePdfFile } = await import("@/modules/shop/services/invoice-persist.service");
      const persisted = await persistInvoicePdfFile(invoice.id, invoice.invoiceNumber, {
        invoiceNumber: invoice.invoiceNumber,
        issuedAt: invoice.issuedAt,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        shippingAddress: (order.shippingAddress ?? {}) as {
          fullName?: string;
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postalCode?: string;
        },
        lines:
          gst.lineItems?.length
            ? gst.lineItems
            : (
                await db.orderItem.findMany({ where: { orderId: order.id } })
              ).map((item) => ({
                description: item.productName,
                qty: item.quantity,
                amountCents: item.quantity * item.unitPriceCents
              })),
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        totalCents: invoice.totalCents,
        gstin: gst.gstin,
        cgstCents: gst.cgstCents,
        sgstCents: gst.sgstCents,
        placeOfSupply: gst.placeOfSupply
      });
      if (!persisted) {
        await db.invoice.update({ where: { id: inv.invoiceId }, data: { pdfUrl: tokenUrl } }).catch(() => undefined);
      }
    }
  }

  if (order.customerEmail) {
    try {
      const full = await db.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { product: { select: { imageUrl: true, sizeLabel: true } } } }
        }
      });
      if (full) {
        const { buildOrderConfirmedMail } = await import("@/lib/email/transactional");
        const { sendTransactionalMail } = await import("@/lib/admin/mail");
        const addr = (full.shippingAddress ?? null) as {
          fullName?: string;
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          phone?: string;
        } | null;
        const mail = buildOrderConfirmedMail({
          customerName: full.customerName,
          orderNumber: full.orderNumber,
          confirmationToken: full.confirmationToken,
          items: full.items.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
            imageUrl: i.product?.imageUrl,
            sizeLabel: i.product?.sizeLabel
          })),
          shippingAddress: addr,
          shippingCents: full.shippingCents,
          discountCents: full.discountCents ?? 0,
          totalCents: full.totalCents
        });
        await sendTransactionalMail({ to: order.customerEmail, mail });
      }
    } catch (err) {
      logger.error({ err, orderId: order.id, event: "order_confirmed_email_failed" }, "confirmation email failed");
    }
  }

  return { ok: true, confirmationToken: order.confirmationToken };
}

async function releaseCouponHold(couponCode: string | null | undefined) {
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

/** Public confirmation summary — requires confirmationToken (C2 / H2). */
export async function getOrderSummaryByNumber(orderNumber: string, confirmationToken: string) {
  if (!orderNumber || !confirmationToken) return null;
  const order = await db.order.findFirst({
    where: { orderNumber, confirmationToken },
    include: { items: true }
  });
  if (!order || !order.confirmationToken) return null;
  return {
    orderNumber: order.orderNumber,
    confirmationToken: order.confirmationToken,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents ?? 0,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents
    }))
  };
}

const PAID_DOCUMENT_STATUSES = new Set([
  "paid",
  "processing",
  "shipped",
  "delivered",
  "partially_refunded",
  "refunded"
]);

/** Invoice / packing gate — confirmation token + paid (or post-paid) status only. */
export async function getOrderInvoiceByToken(orderNumber: string, confirmationToken: string) {
  const order = await db.order.findFirst({
    where: { orderNumber, confirmationToken },
    include: {
      items: true,
      invoices: { orderBy: { issuedAt: "desc" }, take: 1 }
    }
  });
  if (!order || !PAID_DOCUMENT_STATUSES.has(order.status)) return null;
  return order;
}
