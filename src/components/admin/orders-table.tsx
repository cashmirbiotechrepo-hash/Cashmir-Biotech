"use client";

import type { Order, OrderItem } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";
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

type OrderWithItems = Order & {
  items: OrderItem[];
  invoices?: { id: string; invoiceNumber: string }[];
};

const STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "payment_failed",
  "refunded"
] as const;

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function OrderRow({ order }: { order: OrderWithItems }) {
  const { pending, state, onSubmit } = useAdminForm(updateOrderStatusAction);
  const [status, setStatus] = useState(order.status);
  const invoice = order.invoices?.[0];

  return (
    <TableRow>
      <TableCell>
        <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs text-primary hover:underline">
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
        <form onSubmit={onSubmit} className="flex min-w-[11rem] flex-col gap-1.5">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <SaveButton pending={pending} label="Update" />
            <FormStatus state={state} />
          </div>
        </form>
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
        <div className="flex flex-col gap-1 text-xs">
          <Link href={`/admin/orders/${order.id}`} className="text-primary hover:underline">
            Open
          </Link>
          <Link
            href={`/admin/orders/${order.id}/print/packing-slip`}
            className="text-muted-foreground hover:underline"
            target="_blank"
          >
            Pack
          </Link>
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
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead />
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
