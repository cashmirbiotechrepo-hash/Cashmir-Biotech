import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderInvoiceByToken } from "@/modules/shop/services/order.service";
import { SITE_CONTACT } from "@/lib/site-contact";

export const metadata: Metadata = {
  title: "Tax invoice",
  robots: { index: false, follow: false }
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

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
  };

  return (
    <div className="mx-auto max-w-3xl bg-white px-8 py-10 text-ink print:px-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/15 pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Cashmir Biotech</p>
          <h1 className="mt-1 text-2xl font-light">Tax invoice</h1>
          <p className="mt-1 text-xs text-ink-mute">GSTIN {process.env.COMPANY_GSTIN || "—"}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">{invoice.invoiceNumber}</p>
          <p className="mt-1 text-ink-mute">{invoice.issuedAt.toLocaleDateString("en-IN")}</p>
          <p className="mt-1 text-ink-mute">Order {order.orderNumber}</p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Bill to</p>
          <p className="mt-1">{addr.fullName || order.customerName}</p>
          <p className="text-ink-mute">
            {[addr.line1, addr.line2, addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}
          </p>
          <p className="text-ink-mute">{order.customerEmail}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">From</p>
          <p className="mt-1">Cashmir Biotech</p>
          <p className="text-ink-mute">{SITE_CONTACT.location}</p>
          <p className="text-ink-mute">{SITE_CONTACT.primaryEmail}</p>
        </div>
      </section>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink/15 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            <th className="py-2">Item</th>
            <th className="py-2">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/10">
              <td className="py-3">{item.productName}</td>
              <td className="py-3">{item.quantity}</td>
              <td className="py-3 text-right">{inr.format((item.unitPriceCents * item.quantity) / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-mute">Subtotal</dt>
          <dd>{inr.format(invoice.subtotalCents / 100)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-mute">Tax</dt>
          <dd>{inr.format(invoice.taxCents / 100)}</dd>
        </div>
        <div className="flex justify-between border-t border-ink/15 pt-2 text-base font-medium">
          <dt>Total</dt>
          <dd>{inr.format(invoice.totalCents / 100)}</dd>
        </div>
      </dl>

      <p className="mt-10 text-xs text-ink-faint print:hidden">
        <a
          href={`/api/order/${order.orderNumber}/invoice.pdf?t=${t}`}
          className="text-gold underline-offset-4 hover:underline"
        >
          Download PDF invoice
        </a>
        {" · "}
        Or use your browser print dialog to save this page.
      </p>
    </div>
  );
}
