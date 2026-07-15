import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerDocuments } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Documents · Customer Portal",
  robots: { index: false, follow: false }
};

function DocRow({
  title,
  meta,
  href,
  fallbackHref
}: {
  title: string;
  meta: string;
  href?: string | null;
  fallbackHref?: string;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center border border-ink/10 bg-pearl text-ink">
        <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{title}</p>
        <p className="text-[12px] text-ink-mute">{meta}</p>
      </div>
      {href ? (
        <a
          href={href}
          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 border border-ink/12 px-3 text-[12px] font-medium text-ink"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">PDF</span>
        </a>
      ) : fallbackHref ? (
        <Link
          href={fallbackHref}
          className="inline-flex min-h-10 items-center px-2 text-[12px] font-medium text-ink-mute"
        >
          View
        </Link>
      ) : null}
    </li>
  );
}

export default async function PortalDocumentsPage() {
  const session = await requireCustomerSession();
  const docs = await getCustomerDocuments(session.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-[1.65rem] font-light tracking-tight text-ink">Invoices</h1>
        <p className="mt-1 text-[13px] text-ink-mute">GST PDFs, packing slips, and certificates.</p>
      </header>

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">GST invoices</h2>
        {docs.invoices.length === 0 ? (
          <p className="border border-dashed border-ink/15 px-4 py-6 text-[13px] text-ink-mute">
            No invoices yet — they appear once an order is paid.
          </p>
        ) : (
          <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
            {docs.invoices.map((doc, i) => (
              <DocRow
                key={`${doc.label}-${i}`}
                title={doc.label}
                meta={`Order ${doc.orderNumber} · PDF`}
                href={doc.href}
                fallbackHref={`/portal/orders/${doc.orderNumber}`}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Packing slips</h2>
        {docs.packingSlips.length === 0 ? (
          <p className="text-[13px] text-ink-mute">Available for paid orders with a confirmation link.</p>
        ) : (
          <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
            {docs.packingSlips.map((doc, i) => (
              <DocRow
                key={`${doc.label}-${i}`}
                title={doc.label}
                meta="PDF"
                href={doc.href}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Certificates of Analysis</h2>
        {docs.certificates.length === 0 ? (
          <p className="text-[13px] text-ink-mute">
            CoA files for products you have ordered appear when published by the lab.
          </p>
        ) : (
          <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
            {docs.certificates.map((doc, i) => (
              <DocRow
                key={`${doc.label}-${i}`}
                title={doc.label}
                meta={`${doc.productName} · PDF`}
                href={doc.href}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Research library</h2>
        {docs.patents.length === 0 ? (
          <p className="text-[13px] text-ink-mute">
            Patent notes appear for linked formulations.{" "}
            <Link href="/patents" className="text-ink underline-offset-4 hover:underline">
              Browse patents
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
            {docs.patents.map((p) => (
              <li key={p.label} className="flex items-center justify-between gap-3 px-3 py-3">
                <p className="min-w-0 truncate text-[14px] text-ink">{p.label}</p>
                <Link href={p.href} className="shrink-0 text-[13px] font-medium text-ink">
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
