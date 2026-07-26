import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";
import {
  DocFooter,
  DocHeader,
  DocLabel,
  DocMetaRow,
  DocShell,
  DocTableHead,
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
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, invoices: true }
  });
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

      <div className="mt-8 flex items-end justify-between gap-6 border-b border-[#e6e6e8] pb-6">
        <div>
          <p className="text-[7.5pt] font-semibold uppercase tracking-[0.07em] text-[#6b6b70]">
            Amount received
          </p>
          <p className="mt-2 text-[22pt] font-bold tabular-nums leading-none tracking-tight text-[#141416]">
            {formatInrPrint(order.totalCents)}
          </p>
          <p className="mt-2 text-[8.5pt] text-[#6b6b70]">
            Paid {paidAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        {isPaid ? (
          <p className="pb-1 text-[10pt] font-semibold tracking-[0.08em] text-[#1f6142]">●  PAID</p>
        ) : (
          <p className="pb-1 text-[10pt] font-semibold uppercase tracking-[0.08em] text-[#6b6b70]">
            {order.status}
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-10">
        <div>
          <DocLabel>Paid by</DocLabel>
          <div className="mt-2 space-y-0.5 text-[9.5pt] leading-snug">
            {addressLines({
              ...addr,
              fullName: order.customerName ?? addr.fullName,
              email: order.customerEmail ?? undefined
            }).map((l, i) => (
              <p key={l} className={i === 0 ? "font-semibold text-[#141416]" : "text-[#5c5c60]"}>
                {l}
              </p>
            ))}
          </div>
        </div>
        <div>
          <DocLabel>Payment details</DocLabel>
          <dl className="mt-2 space-y-1.5">
            <DocMetaRow label="Payment ID" value={order.razorpayPaymentId || "—"} />
            <DocMetaRow label="Gateway" value={order.razorpayOrderId || "—"} />
            <DocMetaRow label="Invoice" value={inv?.invoiceNumber ?? "Pending"} />
            <DocMetaRow label="Lot" value={batchLabelForOrder(order.orderNumber, order.createdAt)} />
          </dl>
        </div>
      </div>

      <table className="mt-9 w-full text-[9.5pt]">
        <DocTableHead>
          <th className="px-2 py-2">Description</th>
          <th className="px-2 py-2 text-right">Qty</th>
          <th className="px-2 py-2 text-right">Amount</th>
        </DocTableHead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-[#e6e6e8]">
              <td className="px-2 py-3 font-medium">{item.productName}</td>
              <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
              <td className="px-2 py-3 text-right tabular-nums">
                {formatInrPrint(item.unitPriceCents * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-5 w-[52mm] space-y-1.5 text-[9.5pt]">
        <div className="flex justify-between gap-4">
          <span className="text-[#6b6b70]">Subtotal</span>
          <span className="tabular-nums">{formatInrPrint(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6b6b70]">Tax</span>
          <span className="tabular-nums">{formatInrPrint(order.taxCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6b6b70]">Shipping</span>
          <span className="tabular-nums">{formatInrPrint(order.shippingCents)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t-[1.1pt] border-[#141416] pt-2 text-[11pt] font-semibold">
          <span>Total paid</span>
          <span className="tabular-nums">{formatInrPrint(order.totalCents)}</span>
        </div>
      </div>

      <div className="mt-10">
        <DocFooter docLabel={`Receipt ${order.orderNumber}`} />
      </div>
    </DocShell>
  );
}
