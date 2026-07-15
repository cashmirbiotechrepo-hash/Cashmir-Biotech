import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaidEnrollment } from "@/lib/certificate/enrollment";
import { CERTIFICATE_ISSUER, formatInrFromCents } from "@/lib/certificate/courses";
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
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--cert-sapphire)]">
        Enrolment confirmed · /certificate
      </p>
      <h1 className="mt-4 text-4xl text-[var(--cert-pine)]">Receipt ready</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--cert-mute)]">
        Your Computational Biology short-course enrolment is recorded with{" "}
        <span className="font-medium text-[var(--cert-ink)]">{CERTIFICATE_ISSUER.shortName}</span>. Download the
        tax invoice for your records.
      </p>

      <div className="mt-10 rounded-sm border border-[var(--cert-line)] bg-[var(--cert-card)] p-6 sm:p-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cert-mute)]">Invoice</dt>
            <dd className="mt-1 font-medium text-[var(--cert-ink)]">{enrollment.invoiceNumber}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cert-mute)]">Enrolment</dt>
            <dd className="mt-1 font-medium text-[var(--cert-ink)]">{enrollment.enrollmentNumber}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cert-mute)]">Participant</dt>
            <dd className="mt-1 font-medium text-[var(--cert-ink)]">{enrollment.studentName}</dd>
            <dd className="text-sm text-[var(--cert-mute)]">{enrollment.studentEmail}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cert-mute)]">Total credits</dt>
            <dd className="mt-1 text-2xl text-[var(--cert-pine)] cert-display">{enrollment.credits}</dd>
          </div>
        </dl>

        <ul className="mt-8 space-y-2 border-t border-[var(--cert-line)] pt-6">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 text-sm">
              <span>
                <span className="font-mono text-[10px] text-[var(--cert-sapphire)]">{line.code}</span>
                <span className="ml-2 text-[var(--cert-ink)]">{line.title}</span>
              </span>
              <span className="shrink-0 font-mono text-[var(--cert-mute)]">
                {formatInrFromCents(line.feeInclusiveCents)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-baseline justify-between border-t border-[var(--cert-line)] pt-5">
          <span className="text-sm text-[var(--cert-mute)]">Amount paid (incl. GST)</span>
          <span className="cert-display text-3xl text-[var(--cert-pine)]">
            {formatInrFromCents(enrollment.totalCents)}
          </span>
        </div>

        <a
          href={pdfHref}
          className="mt-8 inline-flex w-full items-center justify-center rounded-sm bg-[var(--cert-pine)] px-4 py-3.5 text-sm font-semibold text-[var(--cert-paper)] transition hover:bg-[var(--cert-pine-deep)] sm:w-auto"
        >
          Download SKUAST-K tax invoice (PDF)
        </a>
      </div>

      <p className="mt-8 text-center text-sm text-[var(--cert-mute)]">
        <Link href="/certificate" className="underline-offset-2 hover:underline">
          Return to course desk
        </Link>
        <span className="mx-2">·</span>
        Bookmark this page — it is not linked from the public site.
      </p>
    </div>
  );
}
