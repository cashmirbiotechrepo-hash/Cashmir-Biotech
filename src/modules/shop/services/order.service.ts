import "server-only";
import { db } from "@/lib/db";

// ── Re-exports from segregated services ────────────────────────────────────
export * from "./pricing.service";
export * from "./checkout.service";
export * from "./order-state.service";

// ── Read Operations ────────────────────────────────────────────────────────


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
      items: {
        include: {
          product: { select: { sku: true, sizeLabel: true, imageUrl: true } }
        }
      },
      invoices: { orderBy: { issuedAt: "desc" }, take: 1 }
    }
  });
  if (!order || !PAID_DOCUMENT_STATUSES.has(order.status)) return null;
  return order;
}
