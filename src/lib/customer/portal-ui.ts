/** Shared customer-portal status copy and timeline helpers. */

export const PORTAL_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Confirmed",
  processing: "Preparing",
  shipped: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded"
};

/** Internal/admin event types customers should not see by default. */
const TECHNICAL_TYPES = new Set([
  "inventory_reserved",
  "inventory_deducted",
  "inventory_restored",
  "confirmation_email",
  "ship_email",
  "payment_verified",
  "invoice_generated",
  "fulfillment_updated",
  "status_changed"
]);

const CUSTOMER_TITLE_MAP: Record<string, string> = {
  order_created: "Order placed",
  payment_verified: "Payment received",
  paid: "Payment received",
  processing: "Preparing your order",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  refunded: "Refunded",
  invoice_generated: "Invoice ready",
  fulfillment_updated: "Courier updated",
  ship_email: "Tracking emailed"
};

export type PortalTimelineEntry = {
  id: string;
  at: Date;
  type: string;
  title: string;
  detail: string;
};

export function toCustomerTimeline(
  entries: Array<{ id: string; at: Date; type: string; title: string; detail: string }>
): { customer: PortalTimelineEntry[]; technical: PortalTimelineEntry[] } {
  const customer: PortalTimelineEntry[] = [];
  const technical: PortalTimelineEntry[] = [];

  for (const e of entries) {
    const mapped: PortalTimelineEntry = {
      id: e.id,
      at: e.at,
      type: e.type,
      title: CUSTOMER_TITLE_MAP[e.type] ?? e.title,
      detail: e.detail
    };

    const looksInternal =
      TECHNICAL_TYPES.has(e.type) ||
      /queued|deducted|reserved|verified|razorpay|stock/i.test(`${e.title} ${e.detail}`);

    if (looksInternal && !["shipped", "delivered", "order_created", "invoice_generated"].includes(e.type)) {
      technical.push(mapped);
      continue;
    }

    // Prefer friendly titles for customer stream
    if (e.type === "status_changed") {
      const t = e.title.toLowerCase();
      if (t.includes("packing") || t.includes("processing")) {
        customer.push({ ...mapped, title: "Preparing your order" });
      } else if (t.includes("dispatch") || t.includes("shipped")) {
        customer.push({ ...mapped, title: "Shipped" });
      } else if (t.includes("delivered")) {
        customer.push({ ...mapped, title: "Delivered" });
      } else if (t.includes("paid")) {
        customer.push({ ...mapped, title: "Payment received" });
      } else {
        technical.push(mapped);
      }
      continue;
    }

    if (e.type === "payment_verified") {
      customer.push({ ...mapped, title: "Payment received", detail: "" });
      continue;
    }

    if (e.type === "invoice_generated") {
      customer.push({ ...mapped, title: "Invoice ready" });
      continue;
    }

    if (e.type === "fulfillment_updated" && e.detail?.trim()) {
      customer.push({ ...mapped, title: "Tracking updated" });
      continue;
    }

    customer.push(mapped);
  }

  return { customer, technical };
}

export function timeOfDayGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
