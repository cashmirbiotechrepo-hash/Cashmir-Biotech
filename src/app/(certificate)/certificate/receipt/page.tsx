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
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[11px] font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          SK
        </div>
        <div>
          <p className="cert-title" style={{ fontSize: "0.9375rem" }}>
            {CERTIFICATE_ISSUER.shortName}
          </p>
          <p className="cert-caption">Continuing Education Cell</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Award className="h-5 w-5" />
        </span>
        <div>
          <h1 className="cert-h2" style={{ fontSize: "1.75rem" }}>
            Enrolment confirmed
          </h1>
          <p className="cert-body mt-2">
            Your Computational Biology short-course enrolment is recorded with {CERTIFICATE_ISSUER.shortName}.
            Download your official tax invoice below.
          </p>
        </div>
      </div>

      <div className="cert-card mt-8 p-6 sm:p-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="cert-caption">Invoice</dt>
            <dd className="cert-title mt-1">{enrollment.invoiceNumber}</dd>
          </div>
          <div>
            <dt className="cert-caption">Enrolment</dt>
            <dd className="cert-title mt-1">{enrollment.enrollmentNumber}</dd>
          </div>
          <div>
            <dt className="cert-caption">Participant</dt>
            <dd className="cert-title mt-1">{enrollment.studentName}</dd>
            <dd className="cert-body">{enrollment.studentEmail}</dd>
          </div>
          <div>
            <dt className="cert-caption">Credits</dt>
            <dd className="cert-amount mt-1 text-3xl">{enrollment.credits}</dd>
          </div>
        </dl>

        <ul className="mt-8 space-y-2.5 border-t border-[var(--border)] pt-6">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 text-sm">
              <span>
                <span className="cert-caption">{line.code}</span>
                <span className="ml-2 text-[var(--text)]">{line.title}</span>
              </span>
              <span className="cert-amount shrink-0 text-[var(--text-secondary)]">
                {formatInrExact(line.feeInclusiveCents)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-baseline justify-between border-t border-[var(--border)] pt-5">
          <span className="cert-body">Amount paid (incl. GST)</span>
          <span className="cert-amount text-3xl">{formatInrExact(enrollment.totalCents)}</span>
        </div>

        <a
          href={pdfHref}
          download
          className="cert-btn mt-8 w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Download SKUAST-K tax invoice
        </a>
      </div>

      <p className="mt-8 text-center">
        <Link href="/certificate" className="cert-btn-text">
          Enrol in more courses
        </Link>
      </p>
    </div>
  );
}
