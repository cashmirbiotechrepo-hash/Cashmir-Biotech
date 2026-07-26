import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderInvoiceByToken } from "@/modules/shop/services/order.service";
import { SITE_CONTACT } from "@/lib/site-contact";
import {
  DocFooter,
  DocHeader,
  DocLabel,
  DocShell,
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
  const gstin = process.env.COMPANY_GSTIN || "—";

  return (
    <DocShell>
      <DocHeader
        title="TAX INVOICE"
        number={invoice.invoiceNumber}
        meta={[
          `Issued ${invoice.issuedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
          `Order ${order.orderNumber}`
        ]}
      />

      <p className="mt-6 print:hidden">
        <a
          href={`/api/order/${order.orderNumber}/invoice.pdf?t=${t}`}
          className="text-[10px] text-ink-mute underline-offset-4 hover:underline"
        >
          Download PDF invoice
        </a>
      </p>

      <section className="mt-8 grid gap-6 text-[10px] sm:grid-cols-3">
        <div>
          <DocLabel>Sold by</DocLabel>
          <p className="mt-2 font-semibold text-ink">{SITE_CONTACT.company}</p>
          {SITE_CONTACT.addressLines.map((line) => (
            <p key={line} className="text-ink-mute">
              {line}
            </p>
          ))}
          <p className="mt-1 text-ink-mute">GSTIN {gstin}</p>
          <p className="text-ink-mute">{SITE_CONTACT.primaryEmail}</p>
          <p className="text-ink-mute">{SITE_CONTACT.phone}</p>
        </div>
        <div>
          <DocLabel>Bill to</DocLabel>
          <p className="mt-2 font-semibold text-ink">{addr.fullName || order.customerName}</p>
          {[addr.line1, addr.line2, [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", "), addr.country]
            .filter(Boolean)
            .map((line) => (
              <p key={String(line)} className="text-ink-mute">
                {line}
              </p>
            ))}
          <p className="text-ink-mute">{order.customerEmail}</p>
        </div>
        <div>
          <DocLabel>Details</DocLabel>
          <dl className="mt-2 space-y-1.5">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink-mute">Payment</dt>
              <dd className="font-medium text-[#1f6142]">PAID</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink-mute">Order</dt>
              <dd className="tabular-nums">{order.orderNumber}</dd>
            </div>
          </dl>
        </div>
      </section>

      <table className="mt-10 w-full text-[10px]">
        <thead>
          <tr className="border-b border-ink text-left text-[8px] font-semibold uppercase tracking-[0.08em] text-ink-mute">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/10">
              <td className="py-3 font-medium">{item.productName}</td>
              <td className="py-3 text-right tabular-nums">{item.quantity}</td>
              <td className="py-3 text-right tabular-nums">{formatInrPrint(item.unitPriceCents)}</td>
              <td className="py-3 text-right tabular-nums">
                {formatInrPrint(item.unitPriceCents * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 max-w-[240px] space-y-1.5 text-[10px]">
        <div className="flex justify-between gap-6">
          <dt className="text-ink-mute">Subtotal</dt>
          <dd className="tabular-nums">{formatInrPrint(invoice.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-ink-mute">Tax</dt>
          <dd className="tabular-nums">{formatInrPrint(invoice.taxCents)}</dd>
        </div>
        <div className="flex justify-between gap-6 border-t border-ink pt-2 text-[14px] font-semibold">
          <dt>Total due</dt>
          <dd className="tabular-nums">{formatInrPrint(invoice.totalCents)}</dd>
        </div>
      </dl>

      <div className="mt-10 border-t border-ink/20 pt-4">
        <DocLabel>Note</DocLabel>
        <p className="mt-2 text-[9.5px] text-ink-mute">
          This is a computer-generated tax invoice. Payment confirmation appears when captured.
        </p>
      </div>

      <DocFooter docLabel={`Invoice ${invoice.invoiceNumber}`} />
    </DocShell>
  );
}
