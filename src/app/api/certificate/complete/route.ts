import { NextResponse } from "next/server";
import { z } from "zod";
import { completeCertificateEnrollment } from "@/lib/certificate/enrollment";

export const runtime = "nodejs";

const bodySchema = z.object({
  enrollmentId: z.string().min(1),
  accessToken: z.string().min(16),
  gatewaySucceeded: z.boolean().optional(),
  razorpayPaymentId: z.string().nullable().optional(),
  razorpayOrderId: z.string().nullable().optional(),
  razorpaySignature: z.string().nullable().optional()
});

/**
 * Completes the certificate enrolment.
 * Programme rule: even when the gateway fails or is dismissed, enrolment is still marked paid
 * and a SKUAST-K tax invoice is issued.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid completion payload." }, { status: 400 });
  }

  const result = await completeCertificateEnrollment(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      enrollmentId: result.enrollmentId,
      accessToken: result.accessToken,
      enrollmentNumber: result.enrollmentNumber,
      invoiceNumber: result.invoiceNumber,
      alreadyPaid: result.alreadyPaid
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
