import Image from "next/image";
import type { ReactNode } from "react";
import { SITE_CONTACT } from "@/lib/site-contact";

/** Shared Swiss/print document chrome for HTML invoice, packing slip, receipt. */

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
    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-ink-mute">{children}</p>
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
    <header className="flex items-start justify-between gap-6 border-b border-ink pb-[14px]">
      <div className="flex items-center gap-2.5">
        <Image
          src="/logo.png"
          alt=""
          width={72}
          height={28}
          className="h-7 w-auto object-contain"
          unoptimized
        />
        <p className="text-[17px] font-semibold leading-none tracking-tight text-ink">Cashmir Biotech</p>
      </div>
      <div className="text-right">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink">{title}</p>
        <p className="mt-1.5 text-[15px] font-semibold tabular-nums leading-none text-ink">{number}</p>
        {meta.map((line) => (
          <p key={line} className="mt-1 text-[8px] text-ink-mute">
            {line}
          </p>
        ))}
      </div>
    </header>
  );
}

export function DocFooter({ docLabel }: { docLabel: string }) {
  return (
    <footer className="mt-10 border-t border-ink/20 pt-3 text-[8px] leading-snug text-ink-mute print:mt-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-semibold text-ink">{SITE_CONTACT.company}</p>
          {SITE_CONTACT.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="shrink-0 text-right">
          <p>{docLabel}</p>
          <p className="mt-1 text-ink-faint">Page 1 of 1</p>
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
    <div className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[16mm] text-ink print:max-w-none print:px-[16mm] print:py-[16mm]">
      {toolbar ? <div className="mb-6 flex items-center gap-3 print:hidden">{toolbar}</div> : null}
      {children}
    </div>
  );
}

/** Print-safe empty circle for pick / QC marks (~3 mm). */
export function MarkCircle({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-[3mm] w-[3mm] shrink-0 rounded-full border-[0.7pt] border-ink align-middle ${className}`}
    />
  );
}
