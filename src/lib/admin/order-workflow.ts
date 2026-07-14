/** Warehouse-oriented order status workflow — not a free-form status enum UI. */

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "payment_failed",
  "refunded",
  "partially_refunded"
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

const ALLOWED: Record<string, OrderStatusValue[]> = {
  pending: ["paid", "cancelled", "payment_failed"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  payment_failed: ["pending", "cancelled"],
  refunded: [],
  partially_refunded: ["shipped", "delivered", "refunded"]
};

export function allowedNextStatuses(from: string): OrderStatusValue[] {
  return ALLOWED[from] ?? [];
}

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return allowedNextStatuses(from).includes(to as OrderStatusValue);
}

export type WorkflowStep = {
  key: OrderStatusValue;
  label: string;
};

/** Happy-path pipeline for the command-center header. */
export const FULFILLMENT_PIPELINE: WorkflowStep[] = [
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "processing", label: "Packing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" }
];

export function pipelineIndex(status: string): number {
  const i = FULFILLMENT_PIPELINE.findIndex((s) => s.key === status);
  if (i >= 0) return i;
  if (status === "partially_refunded") return 2;
  return -1;
}

export function statusHeadline(status: string): { title: string; tone: "ready" | "wait" | "done" | "risk" } {
  switch (status) {
    case "paid":
      return { title: "Ready to pack", tone: "ready" };
    case "processing":
      return { title: "Packing in progress", tone: "ready" };
    case "shipped":
      return { title: "In transit", tone: "wait" };
    case "delivered":
      return { title: "Delivered", tone: "done" };
    case "pending":
      return { title: "Awaiting payment", tone: "wait" };
    case "cancelled":
    case "payment_failed":
    case "refunded":
      return { title: status.replace(/_/g, " "), tone: "risk" };
    case "partially_refunded":
      return { title: "Partially refunded", tone: "wait" };
    default:
      return { title: status, tone: "wait" };
  }
}

/** Primary CTA for the sticky action bar / list row. */
export function primaryWorkflowAction(status: string): {
  to: OrderStatusValue;
  label: string;
} | null {
  switch (status) {
    case "paid":
      return { to: "processing", label: "Start packing" };
    case "processing":
      return { to: "shipped", label: "Dispatch / mark shipped" };
    case "shipped":
      return { to: "delivered", label: "Mark delivered" };
    default:
      return null;
  }
}

export function humanStatus(status: string): string {
  return statusHeadline(status).title;
}
