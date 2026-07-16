import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Download } from "lucide-react";
import { getPaidEnrollment } from "@/lib/certificate/enrollment";
import { CERTIFICATE_ISSUER, formatInrExact } from "@/lib/certificate/courses";
import type { CourseLineSnapshot } from "@/lib/certificate/enrollment";

type Props = { searchParams: Promise<{ id?: string; t?: string }> };

export default async function CertificateReceiptPage({ searchParams }: Props) {
  const sp = await searchParams;
  const id = sp.id?.trim();
  const token = sp.t?.trim();
  if (!id || !token) notFound();

  const enrollment = await getPaidEnrollment(id, token);
  if (!enrollment) notFound();

  const lines = enrollment.courseLines as CourseLineSnapshot[];
  const pdfHref = `/api/certificate/${enrollment.id}/invoice.pdf?t=${enrollment.accessToken}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cert-pine)] text-[10px] font-bold text-[var(--cert-paper)]">
          SK
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--cert-pine)]">{CERTIFICATE_ISSUER.shortName}</p>
          <p className="text-xs text-[var(--cert-mute)]">Continuing Education Cell</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cert-sage)] text-[var(--cert-pine)]">
          <Award className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-3xl text-[var(--cert-pine)] sm:text-4xl">Enrolment confirmed</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--cert-mute)]">
            Your Computational Biology short-course enrolment is recorded with {CERTIFICATE_ISSUER.shortName}.
            Download your official tax invoice below.
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-[var(--cert-line)] bg-[var(--cert-card)] p-6 shadow-[0_24px_60px_-40px_rgba(10,41,34,0.4)] sm:p-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cert-mute)]">Invoice</dt>
            <dd className="mt-1 font-medium text-[var(--cert-ink)]">{enrollment.invoiceNumber}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cert-mute)]">Enrolment</dt>
            <dd className="mt-1 font-medium text-[var(--cert-ink)]">{enrollment.enrollmentNumber}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cert-mute)]">Participant</dt>
            <dd className="mt-1 font-medium text-[var(--cert-ink)]">{enrollment.studentName}</dd>
            <dd className="text-sm text-[var(--cert-mute)]">{enrollment.studentEmail}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cert-mute)]">Credits</dt>
            <dd className="mt-1 cert-display text-3xl text-[var(--cert-pine)]">{enrollment.credits}</dd>
          </div>
        </dl>

        <ul className="mt-8 space-y-2.5 border-t border-[var(--cert-line)] pt-6">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 text-sm">
              <span>
                <span className="font-mono text-[10px] text-[var(--cert-sapphire)]">{line.code}</span>
                <span className="ml-2 text-[var(--cert-ink)]">{line.title}</span>
              </span>
              <span className="shrink-0 font-mono text-[var(--cert-mute)]">
                {formatInrExact(line.feeInclusiveCents)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-baseline justify-between border-t border-[var(--cert-line)] pt-5">
          <span className="text-sm text-[var(--cert-mute)]">Amount paid (incl. GST)</span>
          <span className="cert-display text-3xl text-[var(--cert-pine)]">
            {formatInrExact(enrollment.totalCents)}
          </span>
        </div>

        <a
          href={pdfHref}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--cert-pine)] px-5 py-3.5 text-sm font-semibold text-[var(--cert-paper)] transition hover:bg-[var(--cert-pine-mid)] sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Download SKUAST-K tax invoice
        </a>
      </div>

      <p className="mt-8 text-center text-sm text-[var(--cert-mute)]">
        <Link href="/certificate" className="font-medium text-[var(--cert-pine)] underline-offset-2 hover:underline">
          Enrol in more courses
        </Link>
      </p>
    </div>
  );
}
