"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  Mail,
  Package,
  Phone,
  Receipt,
  Truck
} from "lucide-react";
import { updateOrderStatusAction } from "@/app/(admin)/admin/(console)/actions";
import {
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { GenerateInvoiceButton, RefundOrderForm } from "@/components/admin/order-ops-actions";
import { OrderFulfillmentForm } from "@/components/admin/order-fulfillment-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FULFILLMENT_PIPELINE,
  allowedNextStatuses,
  pipelineIndex,
  primaryWorkflowAction,
  statusHeadline,
  type OrderStatusValue
} from "@/lib/admin/order-workflow";
import { cn } from "@/lib/utils";

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatWhen(d: Date | string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDay(d: Date | string) {
  const dt = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dt.toDateString() === today.toDateString()) return "Today";
  if (dt.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type ShippingAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
};

type TimelineEntry = {
  id: string;
  at: Date | string;
  type: string;
  title: string;
  detail: string;
  actorEmail: string;
};

type LineItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  product: { sku: string | null; slug: string | null } | null;
};

type InvoiceLite = { id: string; invoiceNumber: string };

type PaymentEventLite = {
  id: string;
  eventType: string;
  signatureValid: boolean;
  createdAt: Date | string;
};

type CustomerStats = {
  count: number;
  revenueCents: number;
  averageCents: number;
  lastOrderAt: Date | string | null;
  recent: { id: string; orderNumber: string; totalCents: number; createdAt: Date | string }[];
} | null;

export type OrderWorkspaceOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: unknown;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  refundedCents: number | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  stockDeducted: boolean;
  stockReserved: boolean;
  trackingNumber: string | null;
  carrier: string | null;
  adminNotes: string | null;
  shippedAt: Date | string | null;
  items: LineItem[];
  invoices: InvoiceLite[];
  paymentEvents: PaymentEventLite[];
};

const ACTION_LABELS: Record<string, string> = {
  paid: "Mark paid",
  processing: "Start packing",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  payment_failed: "Mark payment failed",
  pending: "Return to pending",
  refunded: "Mark refunded",
  partially_refunded: "Mark partially refunded"
};

function WorkflowAdvanceButton({
  orderId,
  to,
  label,
  variant = "default"
}: {
  orderId: string;
  to: OrderStatusValue;
  label: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const { pending, state, onSubmit } = useAdminForm(updateOrderStatusAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={to} />
      <SaveButton pending={pending} label={label} variant={variant} />
      <FormStatus state={state} />
    </form>
  );
}

function ChecklistRow({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div>
        <p className={cn("font-medium", done ? "text-foreground" : "text-muted-foreground")}>{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function OrderWorkspace({
  order,
  batch,
  timeline,
  customerStats
}: {
  order: OrderWorkspaceOrder;
  batch: string;
  timeline: TimelineEntry[];
  customerStats: CustomerStats;
}) {
  const invoice = order.invoices[0] ?? null;
  const addr = (order.shippingAddress ?? null) as ShippingAddress | null;
  const phone = order.customerPhone || addr?.phone || "";
  const headline = statusHeadline(order.status);
  const primary = primaryWorkflowAction(order.status);
  const next = allowedNextStatuses(order.status);
  const pipeIdx = pipelineIndex(order.status);
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const refundable =
    ["paid", "processing", "shipped", "delivered", "partially_refunded"].includes(order.status) &&
    (order.refundedCents ?? 0) < order.totalCents;
  const [refundOpen, setRefundOpen] = useState(false);

  const secondaryNext = useMemo(
    () => next.filter((s) => s !== primary?.to),
    [next, primary]
  );

  const timelineByDay = useMemo(() => {
    const groups: { day: string; entries: TimelineEntry[] }[] = [];
    const sorted = [...timeline].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    for (const e of sorted) {
      const day = formatDay(e.at);
      const last = groups[groups.length - 1];
      if (last?.day === day) last.entries.push(e);
      else groups.push({ day, entries: [e] });
    }
    return groups;
  }, [timeline]);

  const toneClass =
    headline.tone === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
      : headline.tone === "done"
        ? "border-border bg-muted/50 text-foreground"
        : headline.tone === "risk"
          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100"
          : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100";

  return (
    <div className="pb-28">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-xs text-muted-foreground hover:text-foreground">
            ← Orders
          </Link>
          <h1 className="mt-1 font-mono text-xl font-semibold tracking-tight md:text-2xl">
            {order.orderNumber}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Placed {formatWhen(order.createdAt)} · Lot {batch}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Glance strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Glance label="Status" value={headline.title} />
        <Glance label="Invoice" value={invoice ? "Generated" : "Pending"} />
        <Glance label="Tracking" value={order.trackingNumber ? "Ready" : "Pending"} />
        <Glance
          label="Stock"
          value={order.stockDeducted ? "Deducted" : order.stockReserved ? "Reserved" : "—"}
        />
        <Glance label="Items" value={String(itemCount)} />
        <Glance label="Total" value={formatInr(order.totalCents)} />
      </div>

      {/* Command header */}
      <section className={cn("mb-6 border p-4 md:p-5", toneClass)}>
        <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-70">Next step</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{headline.title}</h2>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <ChecklistRow
            done={["paid", "processing", "shipped", "delivered"].includes(order.status)}
            label="Paid"
          />
          <ChecklistRow done={Boolean(invoice)} label="Invoice generated" hint={invoice?.invoiceNumber} />
          <ChecklistRow
            done={order.stockReserved || order.stockDeducted}
            label={order.stockDeducted ? "Inventory deducted" : "Inventory reserved"}
          />
          <ChecklistRow
            done={["processing", "shipped", "delivered"].includes(order.status)}
            label="Packing"
            hint={order.status === "paid" ? "Awaiting packing" : undefined}
          />
          <ChecklistRow done={Boolean(order.trackingNumber)} label="Courier booked" />
          <ChecklistRow
            done={["shipped", "delivered"].includes(order.status)}
            label="Dispatched"
          />
        </div>

        {pipeIdx >= 0 ? (
          <ol className="mt-5 flex flex-wrap items-center gap-1 text-xs">
            {FULFILLMENT_PIPELINE.map((step, i) => (
              <li key={step.key} className="flex items-center gap-1">
                <span
                  className={cn(
                    "rounded px-2 py-1 font-medium",
                    i < pipeIdx && "bg-foreground/10",
                    i === pipeIdx && "bg-foreground text-background",
                    i > pipeIdx && "text-muted-foreground/70"
                  )}
                >
                  {step.label}
                </span>
                {i < FULFILLMENT_PIPELINE.length - 1 ? (
                  <span className="px-0.5 text-muted-foreground/50">→</span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {primary ? (
            <WorkflowAdvanceButton orderId={order.id} to={primary.to} label={primary.label} />
          ) : null}
          {secondaryNext.map((s) => (
            <WorkflowAdvanceButton
              key={s}
              orderId={order.id}
              to={s}
              label={ACTION_LABELS[s] ?? s}
              variant={s === "cancelled" ? "destructive" : "outline"}
            />
          ))}
          {!primary && next.length === 0 ? (
            <p className="text-sm opacity-80">No further status moves from here.</p>
          ) : null}
        </div>
      </section>

      {/* Sticky documents strip */}
      <div className="sticky top-14 z-30 mb-4 border border-border bg-background/95 p-3 backdrop-blur-md">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Documents
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <DocTile
            icon={FileText}
            title="Invoice"
            status={invoice ? "Ready" : "Waiting"}
            action={
              invoice ? (
                <Link
                  href={`/admin/finance/invoices/${invoice.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open
                </Link>
              ) : (
                <GenerateInvoiceButton orderId={order.id} />
              )
            }
          />
          <DocTile
            icon={Receipt}
            title="Receipt"
            status="Ready"
            action={
              <Link
                href={`/admin/orders/${order.id}/print/receipt`}
                target="_blank"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Print
              </Link>
            }
          />
          <DocTile
            icon={Package}
            title="Packing slip"
            status={["paid", "processing", "shipped", "delivered"].includes(order.status) ? "Ready" : "Locked"}
            action={
              <Link
                href={`/admin/orders/${order.id}/print/packing-slip`}
                target="_blank"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Print
              </Link>
            }
          />
          <DocTile
            icon={Truck}
            title="Courier label"
            status={order.trackingNumber ? "Ready" : "Needs tracking"}
            action={
              <Link
                href={`/admin/orders/${order.id}/print/shipping-label`}
                target="_blank"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Print
              </Link>
            }
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-3">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
            <div className="border border-border">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Products to pack</h3>
              </div>
              <ul className="divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {item.product?.sku || "—"} · Lot {batch}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Qty {item.quantity}
                        {order.stockReserved || order.stockDeducted
                          ? ` · ${order.stockDeducted ? "Stock deducted" : "Stock reserved"}`
                          : ""}
                      </p>
                    </div>
                    <p className="tabular-nums text-sm font-medium">
                      {formatInr(item.unitPriceCents * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t border-border px-4 py-3 text-sm">
                <Row label="Subtotal" value={formatInr(order.subtotalCents)} />
                <Row label="Tax" value={formatInr(order.taxCents)} />
                <Row label="Shipping" value={formatInr(order.shippingCents)} />
                <Row label="Total" value={formatInr(order.totalCents)} strong />
              </div>
            </div>

            <div className="space-y-4">
              <CustomerPanel
                order={order}
                phone={phone}
                addr={addr}
                customerStats={customerStats}
                compact
              />
              {refundable ? (
                <div className="border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Refund</p>
                      <p className="text-xs text-muted-foreground">
                        Available {formatInr(order.totalCents - (order.refundedCents ?? 0))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRefundOpen((v) => !v)}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      {refundOpen ? "Hide" : "Issue refund →"}
                    </button>
                  </div>
                  {refundOpen ? (
                    <RefundOrderForm
                      orderId={order.id}
                      totalCents={order.totalCents}
                      refundedCents={order.refundedCents ?? 0}
                      disabled={
                        !order.razorpayPaymentId || order.razorpayPaymentId.startsWith("test_skip_")
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fulfillment" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border border-border p-4">
              <h3 className="text-sm font-semibold">Shipment</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Carrier" value={order.carrier || "—"} />
                <Row label="Tracking" value={order.trackingNumber || "—"} mono />
                <Row
                  label="Shipment booked"
                  value={order.shippedAt ? formatWhen(order.shippedAt) : "Not yet"}
                />
                <Row
                  label="Notify customer"
                  value={order.status === "shipped" || order.status === "delivered" ? "Sent on ship" : "On dispatch"}
                />
              </dl>
              {order.trackingNumber ? (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${order.carrier ?? ""} ${order.trackingNumber} tracking`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
                >
                  Track shipment
                </a>
              ) : null}
            </div>
            <div className="border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Book / update courier</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Save carrier + AWB, then use <strong>Mark shipped</strong> to email the customer.
              </p>
              <OrderFulfillmentForm order={order} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="border border-border p-4">
            <h3 className="text-sm font-semibold">Payment</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row
                label="Gateway"
                value={
                  order.razorpayPaymentId?.startsWith("test_skip_")
                    ? "Test skip (no Razorpay)"
                    : "Razorpay"
                }
              />
              <Row label="Payment ID" value={order.razorpayPaymentId || "—"} mono />
              <Row label="Razorpay order" value={order.razorpayOrderId || "—"} mono />
              <Row label="Amount" value={formatInr(order.totalCents)} />
              <Row
                label="Refunded"
                value={order.refundedCents ? formatInr(order.refundedCents) : "—"}
              />
            </dl>
          </div>
          {order.paymentEvents.length > 0 ? (
            <div className="border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Gateway events</h3>
              <ul className="space-y-2">
                {order.paymentEvents.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 font-mono text-[11px]">
                    <span className={e.signatureValid ? "" : "text-red-500"}>{e.eventType}</span>
                    <span className="text-muted-foreground">{formatWhen(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="timeline">
          <div className="border border-border p-4 md:p-5">
            {timelineByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="space-y-6">
                {timelineByDay.map((group) => (
                  <div key={group.day}>
                    <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {group.day}
                    </p>
                    <ol className="space-y-4 border-l border-border pl-4">
                      {group.entries.map((e) => (
                        <li key={e.id} className="relative">
                          <span className="absolute -left-[1.35rem] top-1.5 size-2 rounded-full bg-foreground" />
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {new Date(e.at).toLocaleTimeString("en-IN", {
                              hour: "numeric",
                              minute: "2-digit"
                            })}
                          </p>
                          <p className="mt-0.5 text-sm font-medium">{e.title}</p>
                          {e.detail ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="customer">
          <CustomerPanel
            order={order}
            phone={phone}
            addr={addr}
            customerStats={customerStats}
            compact={false}
          />
        </TabsContent>
      </Tabs>

      {/* Persistent ops bar */}
      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 backdrop-blur-md md:bottom-0 md:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-8">
          <p className="text-xs text-muted-foreground">
            <span className="font-mono text-foreground">{order.orderNumber}</span>
            {" · "}
            {headline.title}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/orders/${order.id}/print/packing-slip`}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Package className="size-3.5" />
              Print packing slip
            </Link>
            <Link
              href={`/admin/orders/${order.id}/print/shipping-label`}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Truck className="size-3.5" />
              Print label
            </Link>
            {primary ? (
              <WorkflowAdvanceButton orderId={order.id} to={primary.to} label={primary.label} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Glance({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  mono
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "border-t border-border pt-1 font-medium")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", mono && "max-w-[14rem] truncate font-mono text-[11px]")}>{value}</span>
    </div>
  );
}

function DocTile({
  icon: Icon,
  title,
  status,
  action
}: {
  icon: typeof FileText;
  title: string;
  status: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border border-border bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-[11px] text-muted-foreground">{status}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function CustomerPanel({
  order,
  phone,
  addr,
  customerStats,
  compact
}: {
  order: OrderWorkspaceOrder;
  phone: string;
  addr: ShippingAddress | null;
  customerStats: CustomerStats;
  compact: boolean;
}) {
  const returning = (customerStats?.count ?? 0) > 1;
  return (
    <div className="border border-border p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Customer</p>
      <p className="mt-1 text-lg font-semibold">{order.customerName ?? "Guest"}</p>
      <p className="text-sm text-muted-foreground">{order.customerEmail ?? "No email"}</p>
      {phone ? <p className="text-sm text-muted-foreground">{phone}</p> : null}

      {customerStats ? (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-muted-foreground">Type</p>
            <p className="font-medium">{returning ? "Returning" : "First order"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Orders</p>
            <p className="font-medium tabular-nums">{customerStats.count}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lifetime value</p>
            <p className="font-medium tabular-nums">{formatInr(customerStats.revenueCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Average order</p>
            <p className="font-medium tabular-nums">{formatInr(customerStats.averageCents)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Last order</p>
            <p className="font-medium">
              {customerStats.lastOrderAt
                ? new Date(customerStats.lastOrderAt).toLocaleDateString("en-IN")
                : "—"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.customerEmail ? (
          <a
            href={`mailto:${order.customerEmail}?subject=${encodeURIComponent(`Order ${order.orderNumber}`)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Mail className="size-3.5" />
            Email
          </a>
        ) : null}
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Phone className="size-3.5" />
            Call
          </a>
        ) : null}
        {phone ? (
          <a
            href={`https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Hi regarding order ${order.orderNumber}`)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            WhatsApp
          </a>
        ) : null}
      </div>

      {!compact ? (
        <>
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold">Shipping address</h4>
            {addr ? (
              <address className="mt-2 not-italic text-sm leading-relaxed text-muted-foreground">
                {addr.line1 ? <div>{addr.line1}</div> : null}
                {addr.line2 ? <div>{addr.line2}</div> : null}
                <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}</div>
                {addr.country ? <div>{addr.country}</div> : null}
              </address>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No shipping address on file.</p>
            )}
          </div>
          {customerStats && customerStats.recent.length > 0 ? (
            <div className="mt-4 border-t border-border pt-4">
              <h4 className="text-sm font-semibold">Recent orders</h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                {customerStats.recent.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-primary hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">{formatInr(o.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : addr ? (
        <p className="mt-3 truncate text-xs text-muted-foreground">
          {[addr.city, addr.state].filter(Boolean).join(", ") || addr.line1 || "Address on file"}
        </p>
      ) : null}
    </div>
  );
}
