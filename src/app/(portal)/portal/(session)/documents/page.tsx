import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerDocuments } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Documents · Customer Portal",
  robots: { index: false, follow: false }
};

export default async function PortalDocumentsPage() {
  const session = await requireCustomerSession();
  const docs = await getCustomerDocuments(session.id);

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Scientific archive</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink">Documents</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-mute">
          GST invoices (PDF), certificates of analysis, and patent references for your formulations.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Invoices</h2>
        {docs.invoices.length === 0 ? (
          <p className="text-sm text-ink-mute">No invoices yet — they appear once an order is paid.</p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {docs.invoices.map((doc, i) => (
              <li key={`${doc.label}-${i}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm text-ink">{doc.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    Order {doc.orderNumber}
                  </p>
                </div>
                {doc.href ? (
                  <a href={doc.href} className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                    Download PDF
                  </a>
                ) : (
                  <Link
                    href={`/portal/orders/${doc.orderNumber}`}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                  >
                    View order
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Packing slips</h2>
        {docs.packingSlips.length === 0 ? (
          <p className="text-sm text-ink-mute">Packing slips appear for paid orders with a confirmation link.</p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {docs.packingSlips.map((doc, i) => (
              <li key={`${doc.label}-${i}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm text-ink">{doc.label}</p>
                <a href={doc.href} className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Certificates of Analysis</h2>
        {docs.certificates.length === 0 ? (
          <p className="text-sm text-ink-mute">
            CoA files for products you have ordered appear here when published by the lab.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {docs.certificates.map((doc, i) => (
              <li key={`${doc.label}-${i}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm text-ink">{doc.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    {doc.productName}
                  </p>
                </div>
                <a
                  href={doc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Research library</h2>
        {docs.patents.length === 0 ? (
          <p className="text-sm text-ink-mute">
            Patent-backed notes appear for formulations linked to our registry.{" "}
            <Link href="/patents" className="text-ink underline-offset-4 hover:underline">
              Browse patents
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {docs.patents.map((p) => (
              <li key={p.label} className="rounded-xl border border-ink/10 px-5 py-4">
                <p className="text-sm text-ink">{p.label}</p>
                <Link
                  href={p.href}
                  className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
