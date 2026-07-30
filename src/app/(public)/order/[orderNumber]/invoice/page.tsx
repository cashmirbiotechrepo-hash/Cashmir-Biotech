import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderInvoiceByToken } from "@/modules/shop/services/order.service";
import { SITE_CONTACT } from "@/lib/site-contact";
import { companyLegal } from "@/lib/company-legal";
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

export const metadata: Metadata = {
  title: "Tax invoice",
  robots: { index: false, follow: false }
};

export default async function PublicInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNumber } = await params;
  const { t } = await searchParams;
  if (!t) notFound();
  const order = await getOrderInvoiceByToken(orderNumber, t);
  if (!order) notFound();
  const invoice = order.invoices[0];
  if (!invoice) notFound();

  const addr = (order.shippingAddress ?? {}) as {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string;
    country?: string;
  };
  const { gstin } = companyLegal();

  return (
    <DocShell
      toolbar={
        <a
          href={`/api/order/${order.orderNumber}/invoice.pdf?t=${t}`}
          className="text-sm underline"
        >
          Download PDF invoice
        </a>
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

      <p className="mt-6 text-[9pt] font-semibold tracking-[0.08em] text-[#1f6142]">●  PAID</p>

      <section className="mt-7 grid gap-6 sm:grid-cols-3">
        <div>
          <DocLabel>Sold by</DocLabel>
          <p className="mt-2 text-[10pt] font-semibold">{SITE_CONTACT.company}</p>
          <div className="mt-1 space-y-0.5 text-[8.5pt] leading-snug text-[#5c5c60]">
            {SITE_CONTACT.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <CompanyLegalLines gstin={gstin} />
            <p className="pt-2">{SITE_CONTACT.primaryEmail}</p>
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
              <p key={l} className={i === 0 ? "font-semibold" : "text-[#5c5c60]"}>
                {l}
              </p>
            ))}
          </div>
        </div>
        <div>
          <DocLabel>Details</DocLabel>
          <dl className="mt-2 space-y-1.5">
            <DocMetaRow label="Payment" value="PAID" strong />
            <DocMetaRow label="Order" value={order.orderNumber} />
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
          <span className="text-[#6b6b70]">Tax</span>
          <span className="tabular-nums">{formatInrPrint(invoice.taxCents)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t-[1.1pt] border-[#141416] pt-2 text-[12pt] font-semibold">
          <span>Total due</span>
          <span className="tabular-nums">{formatInrPrint(invoice.totalCents)}</span>
        </div>
      </div>

      <div className="mt-10">
        <DocFooter docLabel={`Invoice ${invoice.invoiceNumber}`} />
      </div>
    </DocShell>
  );
}
