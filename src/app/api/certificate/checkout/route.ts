import { NextResponse } from "next/server";
import { z } from "zod";
import { startCertificateEnrollment } from "@/lib/certificate/enrollment";

export const runtime = "nodejs";

const bodySchema = z.object({
  studentName: z.string().min(2).max(120),
  studentEmail: z.string().email().max(180),
  studentPhone: z.string().max(40).optional(),
  institution: z.string().max(180).optional(),
  placeOfSupply: z.string().max(80).optional(),
  courseIds: z.array(z.string().min(1)).min(1).max(10)
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Check the form and course selection." }, { status: 400 });
  }

  const result = await startCertificateEnrollment(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: true,
      enrollmentId: result.enrollmentId,
      accessToken: result.accessToken,
      enrollmentNumber: result.enrollmentNumber,
      invoiceNumber: result.invoiceNumber,
      amountCents: result.amountCents,
      skipGateway: result.skipGateway,
      keyId: result.keyId,
      razorpayOrderId: result.razorpayOrderId
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
