import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";
import {
  CompanyLegalLines,
  DocFooter,
  DocHeader,
  DocLabel,
  DocMetaRow,
  DocShell,
  DocTableHead,
  formatInrPrint
} from "@/components/admin/order-print-doc";
import { SITE_CONTACT } from "@/lib/site-contact";
import { companyLegal } from "@/lib/company-legal";

export const metadata = { title: "Tax invoice" };

type Addr = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  fullName?: string;
};

type GstDetails = {
  gstin?: string;
  placeOfSupply?: string;
  cgstCents?: number;
  sgstCents?: number;
  igstCents?: number;
  hsn?: string;
};

export default async function OrderInvoicePrintPage({
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
  const invoice = order.invoices[0];
  if (!invoice) notFound();

  const addr = (order.shippingAddress ?? {}) as Addr;
  const gst = (invoice.gstDetails ?? {}) as GstDetails;
  const gstin = gst.gstin || companyLegal().gstin || null;
  const isPaid = ["paid", "processing", "shipped", "delivered"].includes(order.status);
  const pdfHref =
    order.confirmationToken.length > 0
      ? `/api/order/${order.orderNumber}/invoice.pdf?t=${encodeURIComponent(order.confirmationToken)}`
      : null;

  return (
    <DocShell
      toolbar={
        <>
          <PrintButton />
          {pdfHref ? (
            <a href={pdfHref} className="text-sm underline" target="_blank" rel="noreferrer">
              Download PDF
            </a>
          ) : null}
          <Link href={`/admin/orders/${order.id}`} className="text-sm underline">
            ← Order
          </Link>
        </>
      }
    >
      <DocHeader
        title="TAX INVOICE"
        number={invoice.invoiceNumber}
        meta={[
          `Issued ${invoice.issuedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
          `Order ${order.orderNumber}`
        ]}
      />

      <div className="mt-6 flex items-center justify-between">
        <p
          className={`text-[9pt] font-semibold tracking-[0.08em] ${
            isPaid ? "text-[#1f6142]" : "text-[#6b6b70]"
          }`}
        >
          {isPaid ? "●  PAID" : order.status.toUpperCase()}
        </p>
        {gst.placeOfSupply ? (
          <p className="text-[8pt] text-[#6b6b70]">Place of supply · {gst.placeOfSupply}</p>
        ) : null}
      </div>

      <section className="mt-7 grid grid-cols-3 gap-6">
        <div>
          <DocLabel>Sold by</DocLabel>
          <p className="mt-2 text-[10pt] font-semibold">{SITE_CONTACT.company}</p>
          <div className="mt-1 space-y-0.5 text-[8.5pt] leading-snug text-[#5c5c60]">
            {SITE_CONTACT.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {gstin ? <p className="pt-1 tabular-nums">GSTIN {gstin}</p> : null}
            <p>{SITE_CONTACT.primaryEmail}</p>
            <p>{SITE_CONTACT.phone}</p>
          </div>
        </div>
        <div>
          <DocLabel>Bill to</DocLabel>
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
          <DocLabel>Details</DocLabel>
          <dl className="mt-2 space-y-1.5">
            <DocMetaRow label="Payment" value={isPaid ? "PAID" : order.status} strong />
            <DocMetaRow label="Method" value="Razorpay" />
            <DocMetaRow
              label="Paid"
              value={order.updatedAt.toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short"
              })}
            />
            {order.razorpayPaymentId ? (
              <DocMetaRow label="Payment ID" value={order.razorpayPaymentId} />
            ) : null}
          </dl>
        </div>
      </section>

      <table className="mt-9 w-full text-[9.5pt]">
        <DocTableHead>
          <th className="px-2 py-2">Description</th>
          <th className="px-2 py-2 text-right">Qty</th>
          <th className="px-2 py-2 text-right">Rate</th>
          <th className="px-2 py-2 text-right">Amount</th>
        </DocTableHead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-[#e6e6e8]">
              <td className="px-2 py-3 font-medium">{item.productName}</td>
              <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
              <td className="px-2 py-3 text-right tabular-nums">{formatInrPrint(item.unitPriceCents)}</td>
              <td className="px-2 py-3 text-right tabular-nums font-medium">
                {formatInrPrint(item.unitPriceCents * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-5 w-[58mm] space-y-1.5 text-[9.5pt]">
        <div className="flex justify-between gap-4">
          <span className="text-[#6b6b70]">Subtotal</span>
          <span className="tabular-nums">{formatInrPrint(invoice.subtotalCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6b6b70]">Shipping</span>
          <span className="tabular-nums">{formatInrPrint(order.shippingCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6b6b70]">CGST (9%)</span>
          <span className="tabular-nums">{formatInrPrint(gst.cgstCents ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6b6b70]">SGST (9%)</span>
          <span className="tabular-nums">{formatInrPrint(gst.sgstCents ?? 0)}</span>
        </div>
        {(gst.igstCents ?? 0) > 0 ? (
          <div className="flex justify-between gap-4">
            <span className="text-[#6b6b70]">IGST (18%)</span>
            <span className="tabular-nums">{formatInrPrint(gst.igstCents!)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t-[1.1pt] border-[#141416] pt-2 text-[12pt] font-semibold">
          <span>Total due</span>
          <span className="tabular-nums">{formatInrPrint(invoice.totalCents)}</span>
        </div>
      </div>

      <div className="mt-10 border-t border-[#d4d4d6] pt-4">
        <DocLabel>Note</DocLabel>
        <p className="mt-2 text-[8.5pt] leading-relaxed text-[#5c5c60]">
          This is a computer-generated tax invoice. Keep this copy with the shipment records when
          required.
        </p>
      </div>

      <div className="mt-8">
        <DocFooter docLabel={`Invoice ${invoice.invoiceNumber}`} />
      </div>
    </DocShell>
  );
}
