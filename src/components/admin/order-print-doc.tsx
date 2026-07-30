import Image from "next/image";
import type { ReactNode } from "react";
import { SITE_CONTACT } from "@/lib/site-contact";
import { companyLegal, companyLegalLines } from "@/lib/company-legal";

/** Shared institutional print system for invoice, packing slip, receipt, label. */

export function formatInrPrint(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

export function DocLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[7.5pt] font-semibold uppercase tracking-[0.07em] text-[#5c5c60]">{children}</p>
  );
}

/** GSTIN · PAN · CIN block for invoice sold-by sections and footers. */
export function CompanyLegalLines({
  gstin,
  pan,
  cin,
  className = "mt-1 space-y-0.5 text-[8.5pt] leading-snug text-[#5c5c60]"
}: {
  gstin?: string | null;
  pan?: string | null;
  cin?: string | null;
  className?: string;
}) {
  const legal = companyLegal();
  const lines = [
    `GSTIN ${gstin || legal.gstin}`,
    `PAN ${pan || legal.pan}`,
    `CIN ${cin || legal.cin}`
  ];
  return (
    <div className={className}>
      {lines.map((line) => (
        <p key={line} className="tabular-nums">
          {line}
        </p>
      ))}
    </div>
  );
}

export function DocFooterLegalLine() {
  return (
    <p className="mt-1.5 tabular-nums text-[7pt] text-[#8a8a8f]">
      {companyLegalLines().join("  ·  ")}
    </p>
  );
}

export function DocHeader({
  title,
  number,
  meta
}: {
  title: string;
  number: string;
  meta: string[];
}) {
  return (
    <header className="border-b-[1.25pt] border-[#141416] pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={88}
            height={34}
            className="mt-0.5 h-[34px] w-auto object-contain"
            unoptimized
          />
          <div className="min-w-0 pt-0.5">
            <p className="text-[16pt] font-semibold leading-none tracking-[-0.02em] text-[#141416]">
              Cashmir Biotech
            </p>
            <p className="mt-1.5 max-w-[42mm] text-[7pt] leading-snug text-[#6b6b70]">
              {SITE_CONTACT.addressLines[0]}
              <br />
              {SITE_CONTACT.addressLines[3]}, {SITE_CONTACT.addressLines[4]}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[8pt] font-semibold uppercase tracking-[0.08em] text-[#141416]">{title}</p>
          <p className="mt-2 text-[14pt] font-semibold tabular-nums leading-none tracking-tight text-[#141416]">
            {number}
          </p>
          {meta.map((line) => (
            <p key={line} className="mt-1 text-[7.5pt] text-[#6b6b70]">
              {line}
            </p>
          ))}
        </div>
      </div>
    </header>
  );
}

export function DocFooter({ docLabel }: { docLabel: string }) {
  return (
    <footer className="mt-auto border-t border-[#d4d4d6] pt-3 text-[7.5pt] leading-snug text-[#5c5c60]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-semibold text-[#141416]">{SITE_CONTACT.company}</p>
          {SITE_CONTACT.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="mt-1">
            {SITE_CONTACT.primaryEmail} · {SITE_CONTACT.phone}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-[#141416]">{docLabel}</p>
          <p className="mt-1 text-[#8a8a8f]">Page 1 of 1</p>
        </div>
      </div>
    </footer>
  );
}

export function DocShell({
  children,
  toolbar
}: {
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <div className="font-sans text-[#141416] antialiased print:bg-white">
      {toolbar ? (
        <div className="mx-auto mb-5 flex max-w-[210mm] items-center gap-3 px-4 print:hidden md:px-0">
          {toolbar}
        </div>
      ) : null}
      <article className="mx-auto flex min-h-[277mm] max-w-[210mm] flex-col bg-white px-[16mm] py-[15mm] shadow-sm print:min-h-0 print:max-w-none print:shadow-none print:px-[16mm] print:py-[15mm]">
        {children}
      </article>
    </div>
  );
}

export function DocMetaRow({
  label,
  value,
  strong
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex gap-3 text-[9.5pt] leading-snug">
      <dt className="w-[22mm] shrink-0 text-[#6b6b70]">{label}</dt>
      <dd className={`min-w-0 break-words tabular-nums ${strong ? "font-medium text-[#141416]" : "text-[#141416]"}`}>
        {value}
      </dd>
    </div>
  );
}

export function DocTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b-[1.1pt] border-[#141416] bg-[#f3f3f4] text-left text-[7.5pt] font-semibold uppercase tracking-[0.07em] text-[#5c5c60]">
        {children}
      </tr>
    </thead>
  );
}

/** Print-safe empty circle for pick marks (~3 mm). */
export function MarkCircle({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-[3mm] w-[3mm] shrink-0 rounded-full border-[0.7pt] border-[#141416] align-middle ${className}`}
    />
  );
}
