import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const metadata = { title: "Invoice" };

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(cents / 100);
}

type GstDetails = {
  gstin?: string;
  placeOfSupply?: string;
  cgstCents?: number;
  sgstCents?: number;
  igstCents?: number;
  lineItems?: { description: string; qty: number; rateCents: number; amountCents: number }[];
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { order: { include: { items: true } } }
  });
  if (!invoice) notFound();

  const gst = invoice.gstDetails as GstDetails;

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tax invoice</p>
          <h1 className="mt-2 text-2xl font-light">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {new Date(invoice.issuedAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <Link href="/admin/finance" className="text-sm text-primary print:hidden">
          ← Back
        </Link>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-2 text-sm">
        <div>
          <p className="font-medium">Cashmir Biotech Pvt Ltd</p>
          <p className="text-muted-foreground">Kashmir, India</p>
          {gst.gstin ? <p className="mt-2 font-mono text-xs">GSTIN: {gst.gstin}</p> : null}
        </div>
        <div>
          <p className="text-muted-foreground">Place of supply</p>
          <p>{gst.placeOfSupply ?? "Jammu & Kashmir"}</p>
          {invoice.order ? (
            <p className="mt-2 text-muted-foreground">
              Order <span className="font-mono text-foreground">{invoice.order.orderNumber}</span>
            </p>
          ) : null}
        </div>
      </div>

      <table className="mb-8 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(gst.lineItems ?? []).map((line, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-2">{line.description}</td>
              <td className="py-2 text-right tabular-nums">{line.qty}</td>
              <td className="py-2 text-right tabular-nums">{formatInr(line.rateCents)}</td>
              <td className="py-2 text-right tabular-nums">{formatInr(line.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto max-w-xs space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatInr(invoice.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CGST</span>
          <span className="tabular-nums">{formatInr(gst.cgstCents ?? 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">SGST</span>
          <span className="tabular-nums">{formatInr(gst.sgstCents ?? 0)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatInr(invoice.totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
