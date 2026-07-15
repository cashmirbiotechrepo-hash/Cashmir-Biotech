import "server-only";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  CERTIFICATE_ISSUER,
  getCoursesByIds,
  splitInclusiveGst,
  type CertificateCourse
} from "@/lib/certificate/courses";
import { createRazorpayOrder, razorpayConfigured, razorpayPublicKey } from "@/lib/payments/razorpay";

export type CourseLineSnapshot = {
  id: string;
  code: string;
  title: string;
  credits: number;
  hours: number;
  feeInclusiveCents: number;
  taxableCents: number;
  taxCents: number;
};

function yearPrefix() {
  return new Date().getFullYear().toString();
}

async function nextSerial(kind: "ENR" | "INV") {
  const prefix = kind === "ENR" ? `SKUAST-K/CB/${yearPrefix()}/` : `SKUAST-K/TAX/${yearPrefix()}/`;
  const recent = await db.certificateEnrollment.findMany({
    where: kind === "ENR" ? { enrollmentNumber: { startsWith: prefix } } : { invoiceNumber: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { enrollmentNumber: true, invoiceNumber: true }
  });
  let max = 0;
  for (const row of recent) {
    const raw = kind === "ENR" ? row.enrollmentNumber : row.invoiceNumber;
    const n = Number(raw.split("/").pop());
    if (Number.isFinite(n) && n > max) max = n;
  }
  const next = String(max + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

function toLines(courses: CertificateCourse[]): CourseLineSnapshot[] {
  return courses.map((c) => {
    const split = splitInclusiveGst(c.feeInclusiveCents);
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      credits: c.credits,
      hours: c.hours,
      feeInclusiveCents: c.feeInclusiveCents,
      taxableCents: split.taxableCents,
      taxCents: split.taxCents
    };
  });
}

export type StartEnrollmentInput = {
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  institution?: string;
  placeOfSupply?: string;
  courseIds: string[];
};

export async function startCertificateEnrollment(input: StartEnrollmentInput) {
  const name = input.studentName.trim();
  const email = input.studentEmail.toLowerCase().trim();
  if (name.length < 2) return { ok: false as const, error: "Enter the participant’s full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  const uniqueIds = [...new Set(input.courseIds)];
  if (uniqueIds.length < 1 || uniqueIds.length > 10) {
    return { ok: false as const, error: "Select between 1 and 10 courses." };
  }
  const courses = getCoursesByIds(uniqueIds);
  if (courses.length !== uniqueIds.length) {
    return { ok: false as const, error: "One or more selected courses are invalid." };
  }

  const lines = toLines(courses);
  const totalInclusive = lines.reduce((s, l) => s + l.feeInclusiveCents, 0);
  const taxable = lines.reduce((s, l) => s + l.taxableCents, 0);
  const tax = totalInclusive - taxable;
  const half = Math.floor(tax / 2);
  const gstDetails = {
    rate: 0.18,
    inclusive: true,
    hsn: CERTIFICATE_ISSUER.sacHsn,
    cgstCents: half,
    sgstCents: tax - half,
    igstCents: 0,
    placeOfSupply: input.placeOfSupply?.trim() || "Jammu and Kashmir",
    issuer: CERTIFICATE_ISSUER.shortName
  };

  const enrollmentNumber = await nextSerial("ENR");
  const invoiceNumber = await nextSerial("INV");
  const accessToken = createHash("sha256").update(randomBytes(32)).digest("hex");

  const enrollment = await db.certificateEnrollment.create({
    data: {
      enrollmentNumber,
      accessToken,
      invoiceNumber,
      status: "pending",
      studentName: name,
      studentEmail: email,
      studentPhone: (input.studentPhone ?? "").trim(),
      institution: (input.institution ?? "").trim(),
      placeOfSupply: gstDetails.placeOfSupply,
      courseIds: uniqueIds,
      courseLines: lines,
      credits: courses.reduce((s, c) => s + c.credits, 0),
      subtotalCents: taxable,
      taxCents: tax,
      totalCents: totalInclusive,
      gstDetails,
      paymentOutcome: "pending"
    }
  });

  if (!razorpayConfigured()) {
    // Still allow the page to complete successfully without a gateway.
    return {
      ok: true as const,
      enrollmentId: enrollment.id,
      accessToken,
      enrollmentNumber,
      invoiceNumber,
      amountCents: totalInclusive,
      skipGateway: true as const,
      keyId: "",
      razorpayOrderId: null as string | null
    };
  }

  try {
    const receipt = `cb_${enrollment.id.slice(0, 12)}`;
    const rzp = await createRazorpayOrder({
      amountCents: totalInclusive,
      receipt,
      notes: {
        purpose: "skuast_certificate",
        enrollmentId: enrollment.id,
        enrollmentNumber
      }
    });
    await db.certificateEnrollment.update({
      where: { id: enrollment.id },
      data: { razorpayOrderId: rzp.id }
    });
    return {
      ok: true as const,
      enrollmentId: enrollment.id,
      accessToken,
      enrollmentNumber,
      invoiceNumber,
      amountCents: totalInclusive,
      skipGateway: false as const,
      keyId: razorpayPublicKey(),
      razorpayOrderId: rzp.id
    };
  } catch (err) {
    logger.error({ err, event: "certificate_rzp_create_failed", enrollmentId: enrollment.id }, "rzp create failed");
    // Per product rule: enrollment remains completable even when gateway setup fails.
    return {
      ok: true as const,
      enrollmentId: enrollment.id,
      accessToken,
      enrollmentNumber,
      invoiceNumber,
      amountCents: totalInclusive,
      skipGateway: true as const,
      keyId: "",
      razorpayOrderId: null as string | null,
      gatewayCreateFailed: true as const
    };
  }
}

export type CompleteEnrollmentInput = {
  enrollmentId: string;
  accessToken: string;
  /** True when Razorpay reported success with a payment id */
  gatewaySucceeded?: boolean;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  razorpaySignature?: string | null;
};

/**
 * Finalises enrollment as paid and issues the SKUAST-K tax invoice.
 * On this programme only: gateway failure / dismiss still completes successfully.
 */
export async function completeCertificateEnrollment(input: CompleteEnrollmentInput) {
  const enrollment = await db.certificateEnrollment.findUnique({ where: { id: input.enrollmentId } });
  if (!enrollment || enrollment.accessToken !== input.accessToken) {
    return { ok: false as const, error: "Enrollment not found." };
  }

  if (enrollment.status === "paid") {
    return {
      ok: true as const,
      alreadyPaid: true as const,
      enrollmentId: enrollment.id,
      accessToken: enrollment.accessToken,
      enrollmentNumber: enrollment.enrollmentNumber,
      invoiceNumber: enrollment.invoiceNumber
    };
  }

  const hasPaymentId = Boolean(input.razorpayPaymentId?.trim());
  const outcome = input.gatewaySucceeded && hasPaymentId ? "gateway_success" : "gateway_failed_honored";

  const updated = await db.certificateEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status: "paid",
      paidAt: new Date(),
      paymentOutcome: outcome,
      razorpayPaymentId: input.razorpayPaymentId?.trim() || enrollment.razorpayPaymentId || `honored_${enrollment.id}`,
      razorpayOrderId: input.razorpayOrderId?.trim() || enrollment.razorpayOrderId || null
    }
  });

  logger.info(
    {
      event: "certificate_enrollment_paid",
      enrollmentId: updated.id,
      outcome,
      invoiceNumber: updated.invoiceNumber
    },
    "certificate enrollment completed"
  );

  return {
    ok: true as const,
    alreadyPaid: false as const,
    enrollmentId: updated.id,
    accessToken: updated.accessToken,
    enrollmentNumber: updated.enrollmentNumber,
    invoiceNumber: updated.invoiceNumber
  };
}

export async function getPaidEnrollment(enrollmentId: string, accessToken: string) {
  const enrollment = await db.certificateEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.accessToken !== accessToken) return null;
  if (enrollment.status !== "paid") return null;
  return enrollment;
}
