import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";
import {
  DocFooter,
  DocHeader,
  DocLabel,
  DocShell,
  MarkCircle,
  formatInrPrint
} from "@/components/admin/order-print-doc";
import { batchLabelForOrder } from "@/modules/shop/services/order-ops.service";

export const metadata = { title: "Payment receipt" };

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
  const paidAt = order.updatedAt;
  const isPaid = ["paid", "processing", "shipped", "delivered"].includes(order.status);

  return (
    <DocShell
      toolbar={
        <>
          <PrintButton />
          <Link href={`/admin/orders/${order.id}`} className="text-sm underline">
            ← Order
          </Link>
        </>
      }
    >
      <DocHeader
        title="PAYMENT RECEIPT"
        number={order.orderNumber}
        meta={[
          inv?.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : "Invoice pending",
          paidAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        ]}
      />

      <div className="mt-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-[20px] font-bold tabular-nums leading-none text-ink">
            {formatInrPrint(order.totalCents)}
          </p>
          <p className="mt-2 text-[9.5px] text-ink-mute">
            Paid {paidAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        {isPaid ? (
          <p className="text-[10px] font-semibold tracking-[0.08em] text-[#1f6142]">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#1f6142] align-middle" />
            PAID
          </p>
        ) : (
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-mute">
            {order.status}
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <DocLabel>Paid by</DocLabel>
          <div className="mt-2 space-y-0.5 text-[10px] leading-snug">
            {addressLines({
              ...addr,
              fullName: order.customerName ?? addr.fullName,
              email: order.customerEmail ?? undefined
            }).map((l) => (
              <div key={l} className={l === (order.customerName ?? addr.fullName) ? "font-medium text-ink" : "text-ink-mute"}>
                {l}
              </div>
            ))}
          </div>
        </div>
        <div>
          <DocLabel>Payment details</DocLabel>
          <dl className="mt-2 space-y-1.5 text-[10px]">
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 text-ink-mute">Payment ID</dt>
              <dd className="min-w-0 break-all tabular-nums text-ink">{order.razorpayPaymentId || "—"}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 text-ink-mute">Gateway</dt>
              <dd className="min-w-0 break-all tabular-nums text-ink">{order.razorpayOrderId || "—"}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 text-ink-mute">Invoice</dt>
              <dd className="tabular-nums text-ink">{inv?.invoiceNumber ?? "Pending"}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 text-ink-mute">Lot</dt>
              <dd className="tabular-nums text-ink">
                {batchLabelForOrder(order.orderNumber, order.createdAt)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <table className="mt-10 w-full text-[10px]">
        <thead>
          <tr className="border-b border-ink text-left text-[8px] font-semibold uppercase tracking-[0.08em] text-ink-mute">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/10">
              <td className="py-2.5 font-medium">{item.productName}</td>
              <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2.5 text-right tabular-nums">
                {formatInrPrint(item.unitPriceCents * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-4 max-w-[220px] space-y-1.5 text-[10px]">
        <div className="flex justify-between gap-6">
          <span className="text-ink-mute">Subtotal</span>
          <span className="tabular-nums">{formatInrPrint(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-ink-mute">Tax</span>
          <span className="tabular-nums">{formatInrPrint(order.taxCents)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-ink-mute">Shipping</span>
          <span className="tabular-nums">{formatInrPrint(order.shippingCents)}</span>
        </div>
        <div className="flex justify-between gap-6 border-t border-ink pt-2 text-[12px] font-semibold">
          <span>Total paid</span>
          <span className="tabular-nums">{formatInrPrint(order.totalCents)}</span>
        </div>
      </div>

      <DocFooter docLabel={`Receipt ${order.orderNumber}`} />
    </DocShell>
  );
}
