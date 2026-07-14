import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Mail,
  Package,
  Phone,
  Receipt,
  Truck
} from "lucide-react";
import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { OrderFulfillmentForm } from "@/components/admin/order-fulfillment-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  batchLabelForOrder,
  buildOrderTimeline,
  ensureInvoiceForOrder,
  getCustomerOrderStats
} from "@/modules/shop/services/order-ops.service";
import { GenerateInvoiceButton } from "@/components/admin/order-ops-actions";

export const metadata = { title: "Order" };

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(cents / 100);
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

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid" || status === "delivered") return "default";
  if (status === "cancelled" || status === "payment_failed" || status === "refunded") return "destructive";
  return "secondary";
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { sku: true, slug: true } } } },
      invoices: { orderBy: { issuedAt: "desc" } },
      paymentEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!order) notFound();

  // Backfill GST invoice for paid orders that predate automation
  if (
    ["paid", "processing", "shipped", "delivered"].includes(order.status) &&
    order.invoices.length === 0
  ) {
    await ensureInvoiceForOrder(order.id).catch(() => undefined);
  }

  const fresh = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { sku: true, slug: true } } } },
      invoices: { orderBy: { issuedAt: "desc" } },
      paymentEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!fresh) notFound();

  const addr = (fresh.shippingAddress ?? null) as ShippingAddress | null;
  const timeline = buildOrderTimeline(fresh);
  const batch = batchLabelForOrder(fresh.orderNumber, fresh.createdAt);
  const customerStats = await getCustomerOrderStats(fresh.customerEmail);
  const invoice = fresh.invoices[0] ?? null;
  const phone = fresh.customerPhone || addr?.phone || "";

  return (
    <>
      <AdminPageHeader
        title={`Order ${fresh.orderNumber}`}
        description={`Placed ${new Date(fresh.createdAt).toLocaleString("en-IN")} · Lot ${batch}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(fresh.status)}>{fresh.status}</Badge>
            <Link href="/admin/orders" className="text-sm text-primary hover:underline">
              ← Orders
            </Link>
          </div>
        }
      />

      {/* Document command bar */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documents
          </span>
          {invoice ? (
            <Link
              href={`/admin/finance/invoices/${invoice.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <FileText className="size-3.5" />
              Invoice {invoice.invoiceNumber}
            </Link>
          ) : (
            <GenerateInvoiceButton orderId={fresh.id} />
          )}
          <Link
            href={`/admin/orders/${fresh.id}/print/receipt`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            target="_blank"
          >
            <Receipt className="size-3.5" />
            Receipt
          </Link>
          <Link
            href={`/admin/orders/${fresh.id}/print/packing-slip`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            target="_blank"
          >
            <Package className="size-3.5" />
            Packing slip
          </Link>
          <Link
            href={`/admin/orders/${fresh.id}/print/shipping-label`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            target="_blank"
          >
            <Truck className="size-3.5" />
            Courier label
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fresh.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.product?.sku || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{batch}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(item.unitPriceCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(item.unitPriceCents * item.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1 border-t border-border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatInr(fresh.subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatInr(fresh.taxCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="tabular-nums">{formatInr(fresh.shippingCents)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 text-base font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{formatInr(fresh.totalCents)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fulfillment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Save carrier + AWB, then set status to <strong>shipped</strong> to email the customer
                automatically. Shiprocket / Delhivery booking can plug into this same panel later.
              </p>
              <OrderFulfillmentForm order={fresh} />
              {fresh.shippedAt ? (
                <p className="text-xs text-muted-foreground">
                  Marked shipped {new Date(fresh.shippedAt).toLocaleString("en-IN")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-0 border-l border-border pl-5">
                {timeline.map((e) => (
                  <li key={e.id} className="relative pb-5 last:pb-0">
                    <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-foreground" />
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {new Date(e.at).toLocaleString("en-IN")}
                    </p>
                    <p className="mt-0.5 text-sm font-medium">{e.title}</p>
                    {e.detail ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                    ) : null}
                    {e.actorEmail ? (
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{e.actorEmail}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">{fresh.customerName ?? "Guest"}</p>
                <p className="text-muted-foreground">{fresh.customerEmail ?? "No email"}</p>
                {phone ? <p className="text-muted-foreground">☎ {phone}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {fresh.customerEmail ? (
                  <a
                    href={`mailto:${fresh.customerEmail}?subject=${encodeURIComponent(`Order ${fresh.orderNumber}`)}`}
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
                    href={`https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Hi regarding order ${fresh.orderNumber}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
              {customerStats ? (
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Orders</p>
                    <p className="text-base font-medium tabular-nums">{customerStats.count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lifetime spend</p>
                    <p className="text-base font-medium tabular-nums">
                      {formatInr(customerStats.revenueCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Average order</p>
                    <p className="tabular-nums">{formatInr(customerStats.averageCents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last purchase</p>
                    <p>
                      {customerStats.lastOrderAt
                        ? new Date(customerStats.lastOrderAt).toLocaleDateString("en-IN")
                        : "—"}
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping address</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {addr ? (
                <address className="not-italic leading-relaxed text-muted-foreground">
                  {addr.line1 ? <div>{addr.line1}</div> : null}
                  {addr.line2 ? <div>{addr.line2}</div> : null}
                  <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}</div>
                  {addr.country ? <div>{addr.country}</div> : null}
                </address>
              ) : (
                <p className="text-muted-foreground">No shipping address on file.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment & stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Gateway</span>
                <span>
                  {fresh.razorpayPaymentId?.startsWith("test_skip_")
                    ? "Test skip (no Razorpay)"
                    : "Razorpay"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Payment ID</span>
                <span className="max-w-[12rem] truncate font-mono text-[11px]">
                  {fresh.razorpayPaymentId || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Razorpay order</span>
                <span className="max-w-[12rem] truncate font-mono text-[11px]">
                  {fresh.razorpayOrderId || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Stock</span>
                <span>
                  {fresh.stockDeducted ? "Deducted" : fresh.stockReserved ? "Reserved" : "—"}
                </span>
              </div>
              {fresh.paymentEvents.length > 0 ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Gateway events</p>
                  <ul className="space-y-1">
                    {fresh.paymentEvents.map((e) => (
                      <li key={e.id} className="flex justify-between gap-2 font-mono text-[11px]">
                        <span className={e.signatureValid ? "" : "text-red-500"}>{e.eventType}</span>
                        <span className="text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString("en-IN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
