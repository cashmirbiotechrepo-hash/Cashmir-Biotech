import "server-only";
import type { Order, OrderEvent, OrderItem, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendAdminMail } from "@/lib/admin/mail";
import { nextInvoiceNumber } from "@/modules/admin/services/phase2.service";
import { SITE_CONTACT } from "@/lib/site-contact";

export type OrderEventInput = {
  orderId: string;
  type: string;
  title: string;
  detail?: string;
  actorEmail?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordOrderEvent(input: OrderEventInput) {
  try {
    return await db.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: input.type,
        title: input.title,
        detail: input.detail ?? "",
        actorEmail: input.actorEmail ?? "",
        metadata: input.metadata
      }
    });
  } catch (err) {
    logger.error({ err, event: "order_event_failed", orderId: input.orderId }, "failed to record order event");
    return null;
  }
}

/** Biotech lot label for warehouse docs until SKU-level batch tracking is wired. */
export function batchLabelForOrder(orderNumber: string, createdAt: Date) {
  const d = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = orderNumber.slice(-4).toUpperCase();
  return `CB${d}-${suffix}`;
}

/**
 * Creates a GST invoice for a paid order if one does not already exist.
 * Idempotent — safe to call from markOrderPaid and admin actions.
 */
export async function ensureInvoiceForOrder(orderId: string): Promise<{
  created: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
}> {
  const existing = await db.invoice.findFirst({ where: { orderId } });
  if (existing) {
    return { created: false, invoiceId: existing.id, invoiceNumber: existing.invoiceNumber };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) return { created: false };

  const subtotal = order.subtotalCents || order.totalCents;
  const tax = order.taxCents || 0;
  const total = order.totalCents || subtotal + tax;
  const half = Math.round(tax / 2);
  const addr = (order.shippingAddress ?? {}) as { state?: string };

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      orderId: order.id,
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: total,
      gstDetails: {
        gstin: process.env.COMPANY_GSTIN ?? "",
        placeOfSupply: addr.state ?? "Jammu and Kashmir",
        taxType: "intra",
        cgstCents: half,
        sgstCents: half,
        igstCents: 0,
        hsn: "21069099",
        lineItems: order.items.map((item) => ({
          description: item.productName,
          qty: item.quantity,
          rateCents: item.unitPriceCents,
          amountCents: item.quantity * item.unitPriceCents,
          hsn: "21069099"
        }))
      }
    }
  });

  await recordOrderEvent({
    orderId: order.id,
    type: "invoice_generated",
    title: "GST invoice generated",
    detail: invoice.invoiceNumber,
    metadata: { invoiceId: invoice.id }
  });

  return { created: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}

export async function runPaidOrderAutomation(orderId: string, source: string) {
  const invoice = await ensureInvoiceForOrder(orderId).catch((err) => {
    logger.error({ err, orderId, event: "auto_invoice_failed" }, "auto invoice failed");
    return { created: false as const };
  });

  await recordOrderEvent({
    orderId,
    type: "payment_verified",
    title: "Payment verified",
    detail: `Source: ${source}`,
    metadata: { source }
  });

  await recordOrderEvent({
    orderId,
    type: "inventory_deducted",
    title: "Inventory deducted",
    detail: "Reserved stock converted to fulfilled deduction"
  });

  if (invoice.created) {
    // already recorded inside ensureInvoiceForOrder
  }

  await recordOrderEvent({
    orderId,
    type: "confirmation_email",
    title: "Customer confirmation queued",
    detail: "Order confirmation email triggered"
  });

  return invoice;
}

export async function notifyCustomerShipped(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order?.customerEmail) return false;

  const tracking =
    order.trackingNumber && order.carrier
      ? `Carrier: ${order.carrier}\nTracking: ${order.trackingNumber}`
      : order.trackingNumber
        ? `Tracking: ${order.trackingNumber}`
        : "Tracking details will follow shortly.";

  const ok = await sendAdminMail({
    to: order.customerEmail,
    subject: `Your Cashmir Biotech order ${order.orderNumber} has shipped`,
    text: [
      `Hi ${order.customerName ?? "there"},`,
      "",
      `Good news — order ${order.orderNumber} is on its way.`,
      tracking,
      "",
      `Questions? Write to ${SITE_CONTACT.supportEmail}`,
      "",
      "— Cashmir Biotech"
    ].join("\n")
  });

  await recordOrderEvent({
    orderId,
    type: "ship_email",
    title: ok ? "Shipment email sent" : "Shipment email failed",
    detail: order.customerEmail
  });

  return ok;
}

export type TimelineEntry = {
  id: string;
  at: Date;
  type: string;
  title: string;
  detail: string;
  actorEmail: string;
};

/** Prefer recorded events; synthesize baseline from order fields if the table is empty / new. */
export function buildOrderTimeline(
  order: Order & { items: OrderItem[]; events?: OrderEvent[]; invoices?: { invoiceNumber: string; issuedAt: Date }[] }
): TimelineEntry[] {
  const recorded = (order.events ?? []).map((e) => ({
    id: e.id,
    at: e.createdAt,
    type: e.type,
    title: e.title,
    detail: e.detail,
    actorEmail: e.actorEmail
  }));

  if (recorded.length > 0) {
    return recorded.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  const synthetic: TimelineEntry[] = [
    {
      id: "syn-created",
      at: order.createdAt,
      type: "order_created",
      title: "Order created",
      detail: order.orderNumber,
      actorEmail: ""
    }
  ];

  if (order.stockReserved || order.stockDeducted) {
    synthetic.push({
      id: "syn-reserved",
      at: order.createdAt,
      type: "inventory_reserved",
      title: "Inventory reserved",
      detail: `${order.items.reduce((n, i) => n + i.quantity, 0)} unit(s)`,
      actorEmail: ""
    });
  }

  if (["paid", "processing", "shipped", "delivered"].includes(order.status) || order.stockDeducted) {
    synthetic.push({
      id: "syn-paid",
      at: order.updatedAt,
      type: "payment_verified",
      title: "Payment recorded",
      detail: order.razorpayPaymentId || order.status,
      actorEmail: ""
    });
  }

  for (const inv of order.invoices ?? []) {
    synthetic.push({
      id: `syn-inv-${inv.invoiceNumber}`,
      at: inv.issuedAt,
      type: "invoice_generated",
      title: "Invoice on file",
      detail: inv.invoiceNumber,
      actorEmail: ""
    });
  }

  if (order.shippedAt || order.status === "shipped" || order.status === "delivered") {
    synthetic.push({
      id: "syn-ship",
      at: order.shippedAt ?? order.updatedAt,
      type: "shipped",
      title: "Marked shipped",
      detail: [order.carrier, order.trackingNumber].filter(Boolean).join(" · "),
      actorEmail: ""
    });
  }

  if (order.status === "delivered") {
    synthetic.push({
      id: "syn-delivered",
      at: order.updatedAt,
      type: "delivered",
      title: "Delivered",
      detail: "",
      actorEmail: ""
    });
  }

  return synthetic.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function getCustomerOrderStats(email: string | null | undefined) {
  if (!email) return null;
  const orders = await db.order.findMany({
    where: {
      customerEmail: email,
      status: { in: ["paid", "processing", "shipped", "delivered"] }
    },
    select: { totalCents: true, createdAt: true, orderNumber: true, id: true },
    orderBy: { createdAt: "desc" }
  });
  if (orders.length === 0) {
    return { count: 0, revenueCents: 0, averageCents: 0, lastOrderAt: null as Date | null, recent: [] as typeof orders };
  }
  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);
  return {
    count: orders.length,
    revenueCents,
    averageCents: Math.round(revenueCents / orders.length),
    lastOrderAt: orders[0]?.createdAt ?? null,
    recent: orders.slice(0, 5)
  };
}
