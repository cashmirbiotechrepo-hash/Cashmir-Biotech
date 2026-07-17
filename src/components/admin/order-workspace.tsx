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
import { ADMIN_SIDEBAR_OFFSET_CLASS } from "@/components/admin/admin-shell";
import {
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { GenerateInvoiceButton, RefundOrderForm } from "@/components/admin/order-ops-actions";
import { OrderFulfillmentForm } from "@/components/admin/order-fulfillment-form";
import { OrderShippingOverrideForm } from "@/components/admin/order-shipping-override-form";
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
    <div className="inline-flex items-center gap-1.5">
      {done ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
      )}
      <span className={cn(done ? "text-foreground" : "text-muted-foreground")}>
        {label}
        {hint ? <span className="text-muted-foreground"> · {hint}</span> : null}
      </span>
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

  return (
    <div className="pb-24">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin/orders" className="text-[11px] text-muted-foreground hover:text-foreground">
            ← Orders
          </Link>
          <h1 className="mt-0.5 font-mono text-lg font-semibold tracking-tight md:text-xl">
            {order.orderNumber}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {formatWhen(order.createdAt)} · Lot {batch}
          </p>
        </div>
        <Badge variant="outline" className="h-6 capitalize text-[11px] font-normal">
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Glance — labels only, no card borders */}
      <div className="mb-4 grid grid-cols-3 gap-x-4 gap-y-2 border-b border-border/70 pb-3 text-sm sm:grid-cols-6">
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

      {/* Compact next-step + progress rail */}
      <section className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Next step
            </p>
            <h2
              className={cn(
                "text-base font-medium tracking-tight",
                headline.tone === "risk" && "text-destructive",
                headline.tone === "ready" && "text-emerald-800 dark:text-emerald-300"
              )}
            >
              {headline.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
          </div>
        </div>

        {pipeIdx >= 0 ? (
          <ol className="mt-3 flex items-center gap-0">
            {FULFILLMENT_PIPELINE.map((step, i) => {
              const done = i < pipeIdx;
              const current = i === pipeIdx;
              return (
                <li key={step.key} className="flex min-w-0 flex-1 items-center">
                  <div className="flex min-w-0 flex-col items-center gap-1">
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        done || current ? "bg-foreground" : "bg-border",
                        current && "ring-2 ring-foreground/25 ring-offset-2 ring-offset-background"
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-[10px]",
                        current ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < FULFILLMENT_PIPELINE.length - 1 ? (
                    <div
                      className={cn(
                        "mx-1 mb-4 h-px flex-1",
                        i < pipeIdx ? "bg-foreground/40" : "bg-border"
                      )}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
          <ChecklistRow
            done={["paid", "processing", "shipped", "delivered"].includes(order.status)}
            label="Paid"
          />
          <ChecklistRow done={Boolean(invoice)} label="Invoice" hint={invoice?.invoiceNumber} />
          <ChecklistRow
            done={order.stockReserved || order.stockDeducted}
            label={order.stockDeducted ? "Stock out" : "Reserved"}
          />
          <ChecklistRow done={Boolean(order.trackingNumber)} label="Courier" />
          <ChecklistRow
            done={["shipped", "delivered"].includes(order.status)}
            label="Dispatched"
          />
        </div>
      </section>

      {/* Compact documents strip */}
      <div className="sticky top-11 z-30 mb-4 border-y border-border/70 bg-background/95 py-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <DocTile
            icon={FileText}
            title="Invoice"
            status={invoice ? "Ready" : "Waiting"}
            action={
              invoice ? (
                <Link
                  href={`/admin/finance/invoices/${invoice.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs")}
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
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs")}
              >
                Print
              </Link>
            }
          />
          <DocTile
            icon={Package}
            title="Packing"
            status={["paid", "processing", "shipped", "delivered"].includes(order.status) ? "Ready" : "Locked"}
            action={
              <Link
                href={`/admin/orders/${order.id}/print/packing-slip`}
                target="_blank"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs")}
              >
                Print
              </Link>
            }
          />
          <DocTile
            icon={Truck}
            title="Label"
            status={order.trackingNumber ? "Ready" : "Waiting"}
            action={
              <Link
                href={`/admin/orders/${order.id}/print/shipping-label`}
                target="_blank"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs")}
              >
                Print
              </Link>
            }
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-2">
        <TabsList variant="line" className="h-8 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="fulfillment" className="text-xs">
            Fulfillment
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">
            Payments
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="customer" className="text-xs">
            Customer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-[1.45fr_0.9fr]">
            <div className="rounded-md border border-border/80">
              <div className="border-b border-border/70 px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Products to pack
                </h3>
              </div>
              <ul className="divide-y divide-border/60">
                {order.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.product?.sku || "—"} · Lot {batch} · Qty {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums">
                      {formatInr(item.unitPriceCents * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="space-y-0.5 border-t border-border/70 px-3 py-2 text-sm">
                <Row label="Subtotal" value={formatInr(order.subtotalCents)} />
                <Row label="Tax" value={formatInr(order.taxCents)} />
                <Row label="Shipping" value={formatInr(order.shippingCents)} />
                <Row label="Total" value={formatInr(order.totalCents)} strong />
              </div>
              <div className="border-t border-border/70 px-3 py-2">
                <OrderShippingOverrideForm
                  order={{
                    id: order.id,
                    status: order.status,
                    shippingCents: order.shippingCents,
                    totalCents: order.totalCents,
                    razorpayOrderId: order.razorpayOrderId
                  }}
                />
              </div>
            </div>

            <CustomerPanel
              order={order}
              phone={phone}
              addr={addr}
              customerStats={customerStats}
              compact
            />
          </div>
        </TabsContent>

        <TabsContent value="fulfillment" className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-border/80 p-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Shipment
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <Row label="Carrier" value={order.carrier || "—"} />
                <Row label="Tracking" value={order.trackingNumber || "—"} mono />
                <Row
                  label="Booked"
                  value={order.shippedAt ? formatWhen(order.shippedAt) : "Not yet"}
                />
              </dl>
              {order.trackingNumber ? (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${order.carrier ?? ""} ${order.trackingNumber} tracking`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 h-8")}
                >
                  Track shipment
                </a>
              ) : null}
            </div>
            <div className="rounded-md border border-border/80 p-3">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Book / update courier
              </h3>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Save carrier + AWB, then Mark shipped to email the customer.
              </p>
              <OrderFulfillmentForm order={order} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-3">
          <div className="rounded-md border border-border/80 p-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment
            </h3>
            <dl className="mt-2 space-y-1 text-sm">
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
            {refundable ? (
              <div className="mt-3 border-t border-border/70 pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Available {formatInr(order.totalCents - (order.refundedCents ?? 0))}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefundOpen((v) => !v)}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
                  >
                    {refundOpen ? "Hide" : "Issue refund"}
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
          {order.paymentEvents.length > 0 ? (
            <div className="rounded-md border border-border/80 p-3">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gateway events
              </h3>
              <ul className="space-y-1.5">
                {order.paymentEvents.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 font-mono text-[11px]">
                    <span className={e.signatureValid ? "" : "text-destructive"}>{e.eventType}</span>
                    <span className="text-muted-foreground">{formatWhen(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="timeline">
          <div className="py-1">
            {timelineByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="space-y-5">
                {timelineByDay.map((group) => (
                  <div key={group.day}>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {group.day}
                    </p>
                    <ol className="space-y-3 border-l border-border/80 pl-3">
                      {group.entries.map((e) => (
                        <li key={e.id} className="relative">
                          <span className="absolute -left-[0.97rem] top-1.5 size-1.5 rounded-full bg-foreground" />
                          <p className="text-[10px] tabular-nums text-muted-foreground">
                            {new Date(e.at).toLocaleTimeString("en-IN", {
                              hour: "numeric",
                              minute: "2-digit"
                            })}
                          </p>
                          <p className="text-sm font-medium">{e.title}</p>
                          {e.detail ? (
                            <p className="text-xs text-muted-foreground">{e.detail}</p>
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

      {/* Contextual sticky ops bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 backdrop-blur-md md:bottom-0",
          ADMIN_SIDEBAR_OFFSET_CLASS
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 md:px-6">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-mono text-foreground">{order.orderNumber}</span>
            {" · "}
            {headline.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {["paid", "processing"].includes(order.status) ? (
              <Link
                href={`/admin/orders/${order.id}/print/packing-slip`}
                target="_blank"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs")}
              >
                <Package className="size-3.5" />
                Print slip
              </Link>
            ) : null}
            {order.trackingNumber || ["processing", "shipped"].includes(order.status) ? (
              <Link
                href={`/admin/orders/${order.id}/print/shipping-label`}
                target="_blank"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs")}
              >
                <Truck className="size-3.5" />
                Print label
              </Link>
            ) : null}
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
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm tabular-nums text-foreground">{value}</p>
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
    <div className={cn("flex justify-between gap-3", strong && "border-t border-border/70 pt-1 font-medium")}>
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
    <div className="flex min-w-[9.5rem] flex-1 items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-xs text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{status}</p>
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
    <div className="rounded-md border border-border/80 p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Customer</p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-medium">{order.customerName ?? "Guest"}</p>
          <p className="truncate text-xs text-muted-foreground">{order.customerEmail ?? "No email"}</p>
          {phone ? <p className="text-xs text-muted-foreground">{phone}</p> : null}
        </div>
        <div className="flex shrink-0 gap-0.5">
          {order.customerEmail ? (
            <a
              href={`mailto:${order.customerEmail}?subject=${encodeURIComponent(`Order ${order.orderNumber}`)}`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7")}
              aria-label="Email"
              title="Email"
            >
              <Mail className="size-3.5" />
            </a>
          ) : null}
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7")}
              aria-label="Call"
              title="Call"
            >
              <Phone className="size-3.5" />
            </a>
          ) : null}
          {phone ? (
            <a
              href={`https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Hi regarding order ${order.orderNumber}`)}`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7 text-[10px] font-medium")}
              aria-label="WhatsApp"
              title="WhatsApp"
            >
              WA
            </a>
          ) : null}
        </div>
      </div>

          {customerStats ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/70 pt-2 text-[11px]">
          <div>
            <p className="text-muted-foreground">Type</p>
            <p>{returning ? "Returning" : "First order"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Orders</p>
            <p className="tabular-nums">{customerStats.count}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lifetime</p>
            <p className="tabular-nums">{formatInr(customerStats.revenueCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Average</p>
            <p className="tabular-nums">{formatInr(customerStats.averageCents)}</p>
          </div>
        </div>
      ) : null}

      {order.adminNotes ? (
        <div className="mt-2 border-t border-border/70 pt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-0.5 text-xs leading-snug text-foreground">{order.adminNotes}</p>
        </div>
      ) : null}

      {!compact ? (
        <>
          <div className="mt-3 border-t border-border/70 pt-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Shipping address
            </h4>
            {addr ? (
              <address className="mt-1 not-italic text-sm leading-relaxed text-muted-foreground">
                {addr.line1 ? <div>{addr.line1}</div> : null}
                {addr.line2 ? <div>{addr.line2}</div> : null}
                <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}</div>
                {addr.country ? <div>{addr.country}</div> : null}
              </address>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No shipping address on file.</p>
            )}
          </div>
          {customerStats && customerStats.recent.length > 0 ? (
            <div className="mt-3 border-t border-border/70 pt-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent orders
              </h4>
              <ul className="mt-1.5 space-y-1 text-sm">
                {customerStats.recent.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-xs text-foreground underline-offset-2 hover:underline"
                    >
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
        <p className="mt-2 truncate text-[11px] text-muted-foreground">
          {[addr.city, addr.state].filter(Boolean).join(", ") || addr.line1 || "Address on file"}
        </p>
      ) : null}
    </div>
  );
}
