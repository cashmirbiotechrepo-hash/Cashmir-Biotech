import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines, formatInrCents } from "@/components/admin/order-print-shell";
import { batchLabelForOrder } from "@/modules/shop/services/order-ops.service";
import { SITE_CONTACT } from "@/lib/site-contact";

export const metadata = { title: "Receipt" };

type Addr = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  fullName?: string;
  email?: string;
};

export default async function OrderReceiptPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true, invoices: true } });
  if (!order) notFound();
  const addr = (order.shippingAddress ?? {}) as Addr;
  const inv = order.invoices[0];

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-ink print:max-w-none print:p-0">
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <PrintButton />
        <Link href={`/admin/orders/${order.id}`} className="text-sm underline">
          ← Order
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-ink/15 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">Payment receipt</p>
          <h1 className="mt-1 text-2xl font-light">Receipt</h1>
          <p className="mt-1 text-sm text-ink-mute">Order {order.orderNumber}</p>
        </div>
        <p className="text-right text-sm font-medium">Cashmir Biotech</p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Paid by</p>
          <div className="mt-2 space-y-0.5 text-sm">
            {addressLines({ ...addr, fullName: order.customerName ?? addr.fullName, email: order.customerEmail ?? undefined }).map(
              (l) => (
                <div key={l}>{l}</div>
              )
            )}
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-ink-mute">Status</span>
            <span className="font-medium uppercase">{order.status}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-mute">Payment ID</span>
            <span className="max-w-[14rem] truncate font-mono text-xs">{order.razorpayPaymentId || "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-mute">Gateway order</span>
            <span className="max-w-[14rem] truncate font-mono text-xs">{order.razorpayOrderId || "test / skip"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-mute">Invoice</span>
            <span className="font-mono text-xs">{inv?.invoiceNumber ?? "Pending"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-mute">Paid at</span>
            <span>{new Date(order.updatedAt).toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-ink/15 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/8">
              <td className="py-2.5">{item.productName}</td>
              <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2.5 text-right tabular-nums">
                {formatInrCents(item.unitPriceCents * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-4 max-w-[220px] space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-mute">Subtotal</span>
          <span className="tabular-nums">{formatInrCents(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-mute">Tax</span>
          <span className="tabular-nums">{formatInrCents(order.taxCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-mute">Shipping</span>
          <span className="tabular-nums">{formatInrCents(order.shippingCents)}</span>
        </div>
        <div className="flex justify-between border-t border-ink pt-2 text-base font-medium">
          <span>Total paid</span>
          <span className="tabular-nums">{formatInrCents(order.totalCents)}</span>
        </div>
      </div>

      <p className="mt-10 text-xs text-ink-mute">
        Lot reference {batchLabelForOrder(order.orderNumber, order.createdAt)}. Support:{" "}
        {SITE_CONTACT.supportEmail}
      </p>
    </div>
  );
}
