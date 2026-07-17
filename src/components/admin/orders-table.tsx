"use client";

import type { Order, OrderItem } from "@prisma/client";
import Link from "next/link";
import { CreditCard, MoreHorizontal, Truck } from "lucide-react";
import { updateOrderStatusAction } from "@/app/(admin)/admin/(console)/actions";
import { FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  allowedNextStatuses,
  humanStatus,
  primaryWorkflowAction,
  type OrderStatusValue
} from "@/lib/admin/order-workflow";
import { cn } from "@/lib/utils";

type OrderWithItems = Order & {
  items: OrderItem[];
  invoices?: { id: string; invoiceNumber: string }[];
};

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function orderAgeHours(createdAt: Date | string) {
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
}

function orderAge(createdAt: Date | string) {
  const hours = orderAgeHours(createdAt);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Aging fulfillment work rises in priority; terminal states stay quiet. */
function orderPriority(status: string, createdAt: Date | string): "high" | "med" | null {
  if (!["paid", "processing"].includes(status)) return null;
  const hours = orderAgeHours(createdAt);
  if (hours >= 24) return "high";
  if (hours >= 6) return "med";
  return null;
}

function NextStepForm({ orderId, to, label }: { orderId: string; to: OrderStatusValue; label: string }) {
  const { pending, state, onSubmit } = useAdminForm(updateOrderStatusAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="inline-flex flex-col gap-0.5">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={to} />
      <SaveButton pending={pending} label={label} />
      <FormStatus state={state} />
    </form>
  );
}

function OrderRow({ order }: { order: OrderWithItems }) {
  const invoice = order.invoices?.[0];
  const primary = primaryWorkflowAction(order.status);
  const canCancel = allowedNextStatuses(order.status).includes("cancelled");
  const age = orderAge(order.createdAt);
  const priority = orderPriority(order.status, order.createdAt);
  const paid =
    Boolean(order.razorpayPaymentId) ||
    ["paid", "processing", "shipped", "delivered", "partially_refunded", "refunded"].includes(
      order.status
    );

  return (
    <TableRow className="h-10">
      <TableCell className="py-1.5">
        <div className="flex items-start gap-1.5">
          {priority ? (
            <span
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                priority === "high" ? "bg-destructive" : "bg-amber-500"
              )}
              title={priority === "high" ? "Overdue (>24h)" : "Aging (>6h)"}
            />
          ) : (
            <span className="mt-1.5 size-1.5 shrink-0" />
          )}
          <div className="min-w-0">
            <Link
              href={`/admin/orders/${order.id}`}
              className="font-mono text-xs text-foreground underline-offset-2 hover:underline"
            >
              {order.orderNumber}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
              <span>{age} ago</span>
              {paid ? (
                <span className="inline-flex items-center gap-0.5" title="Payment captured">
                  <CreditCard className="size-2.5" />
                </span>
              ) : null}
              {order.trackingNumber ? (
                <span className="inline-flex max-w-[9rem] items-center gap-0.5 truncate" title={order.trackingNumber}>
                  <Truck className="size-2.5 shrink-0" />
                  {order.carrier || "Courier"}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-[10rem] py-1.5">
        <p className="truncate text-sm">{order.customerName ?? "Guest"}</p>
        <p className="truncate text-[11px] text-muted-foreground">{order.customerEmail ?? "—"}</p>
      </TableCell>
      <TableCell className="py-1.5 text-[12px] text-muted-foreground">
        {new Date(order.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </TableCell>
      <TableCell className="py-1.5 text-right text-sm tabular-nums">{formatInr(order.totalCents)}</TableCell>
      <TableCell className="py-1.5">
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant="secondary" className="h-5 capitalize text-[10px] font-normal">
            {humanStatus(order.status)}
          </Badge>
          {primary ? (
            <NextStepForm orderId={order.id} to={primary.to} label={primary.label} />
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-1.5 text-xs text-muted-foreground">
        {order.items.length}
        {order.stockDeducted ? " · out" : order.stockReserved ? " · held" : ""}
      </TableCell>
      <TableCell className="py-1.5">
        {invoice ? (
          <Link
            href={`/admin/finance/invoices/${invoice.id}`}
            className="font-mono text-[11px] text-foreground underline-offset-2 hover:underline"
          >
            {invoice.invoiceNumber}
          </Link>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-7" aria-label="Order actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem render={<Link href={`/admin/orders/${order.id}`} />}>
              Open workspace
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link href={`/admin/orders/${order.id}/print/packing-slip`} target="_blank" />
              }
            >
              Print packing slip
            </DropdownMenuItem>
            {invoice ? (
              <DropdownMenuItem render={<Link href={`/admin/finance/invoices/${invoice.id}`} />}>
                Open invoice
              </DropdownMenuItem>
            ) : null}
            {canCancel ? (
              <>
                <DropdownMenuSeparator />
                <CancelMenuItem orderId={order.id} />
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function CancelMenuItem({ orderId }: { orderId: string }) {
  const { pending, onSubmit } = useAdminForm(updateOrderStatusAction, { refresh: true });
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value="cancelled" />
      <DropdownMenuItem
        variant="destructive"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          const form = (e.currentTarget as HTMLElement).closest("form");
          form?.requestSubmit();
        }}
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </DropdownMenuItem>
    </form>
  );
}

export function OrdersTable({ orders }: { orders: OrderWithItems[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/80">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 text-[11px] font-medium">Order</TableHead>
            <TableHead className="h-9 text-[11px] font-medium">Customer</TableHead>
            <TableHead className="h-9 text-[11px] font-medium">Date</TableHead>
            <TableHead className="h-9 text-right text-[11px] font-medium">Total</TableHead>
            <TableHead className="h-9 text-[11px] font-medium">Workflow</TableHead>
            <TableHead className="h-9 text-[11px] font-medium">Items</TableHead>
            <TableHead className="h-9 text-[11px] font-medium">Invoice</TableHead>
            <TableHead className="h-9 w-10 text-[11px] font-medium" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
