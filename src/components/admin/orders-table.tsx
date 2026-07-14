"use client";

import type { Order, OrderItem } from "@prisma/client";
import Link from "next/link";
import { updateOrderStatusAction } from "@/app/(admin)/admin/(console)/actions";
import { FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

function NextStepForm({ orderId, to, label }: { orderId: string; to: OrderStatusValue; label: string }) {
  const { pending, state, onSubmit } = useAdminForm(updateOrderStatusAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={to} />
      <SaveButton pending={pending} label={label} />
      <FormStatus state={state} />
    </form>
  );
}

function CancelForm({ orderId }: { orderId: string }) {
  const { pending, state, onSubmit } = useAdminForm(updateOrderStatusAction, { refresh: true });
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value="cancelled" />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] text-muted-foreground hover:text-destructive"
      >
        {pending ? "…" : "Cancel"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}

function OrderRow({ order }: { order: OrderWithItems }) {
  const invoice = order.invoices?.[0];
  const primary = primaryWorkflowAction(order.status);
  const canCancel = allowedNextStatuses(order.status).includes("cancelled");

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/admin/orders/${order.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {order.orderNumber}
        </Link>
        {order.trackingNumber ? (
          <p className="mt-0.5 max-w-[9rem] truncate font-mono text-[10px] text-muted-foreground">
            {order.carrier ? `${order.carrier} · ` : ""}
            {order.trackingNumber}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="max-w-[10rem]">
        <p className="truncate text-sm">{order.customerName ?? "Guest"}</p>
        <p className="truncate text-xs text-muted-foreground">{order.customerEmail ?? "—"}</p>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(order.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatInr(order.totalCents)}</TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Badge variant="secondary" className="capitalize">
            {humanStatus(order.status)}
          </Badge>
          {primary ? (
            <NextStepForm orderId={order.id} to={primary.to} label={primary.label} />
          ) : (
            <p className="text-[11px] text-muted-foreground">No next step</p>
          )}
          {canCancel ? <CancelForm orderId={order.id} /> : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge variant="outline">{order.items.length} items</Badge>
          {order.stockDeducted ? (
            <span className="text-[10px] text-muted-foreground">Stock out</span>
          ) : order.stockReserved ? (
            <span className="text-[10px] text-amber-700">Reserved</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {invoice ? (
          <Link
            href={`/admin/finance/invoices/${invoice.id}`}
            className="font-mono text-[11px] text-primary hover:underline"
          >
            {invoice.invoiceNumber}
          </Link>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex min-w-[8.5rem] flex-col gap-1 text-xs">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Actions</p>
          <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:underline">
            View order →
          </Link>
          <Link
            href={`/admin/orders/${order.id}/print/packing-slip`}
            className="text-muted-foreground hover:underline"
            target="_blank"
          >
            Print packing slip
          </Link>
          {invoice ? (
            <Link
              href={`/admin/finance/invoices/${invoice.id}`}
              className="text-muted-foreground hover:underline"
            >
              Print invoice
            </Link>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function OrdersTable({ orders }: { orders: OrderWithItems[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
