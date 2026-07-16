import { NextResponse } from "next/server";
import { getPaidEnrollment } from "@/lib/certificate/enrollment";
import { buildSkuastCertificateInvoicePdf } from "@/lib/certificate/skuast-invoice-pdf";
import { sanitizePdfFilename, siteBaseUrl } from "@/modules/shop/services/pdf-brand";
import type { CourseLineSnapshot } from "@/lib/certificate/enrollment";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const enrollment = await getPaidEnrollment(id, token);
  if (!enrollment) {
    return NextResponse.json({ error: "Invoice not available" }, { status: 404 });
  }

  const gst = enrollment.gstDetails as {
    cgstCents?: number;
    sgstCents?: number;
  };

  const lines = enrollment.courseLines as CourseLineSnapshot[];
  const verifyUrl = `${siteBaseUrl()}/certificate/receipt?id=${enrollment.id}&t=${enrollment.accessToken}`;

  try {
    const pdf = await buildSkuastCertificateInvoicePdf({
      invoiceNumber: enrollment.invoiceNumber,
      enrollmentNumber: enrollment.enrollmentNumber,
      issuedAt: enrollment.paidAt ?? enrollment.createdAt,
      paidAt: enrollment.paidAt,
      studentName: enrollment.studentName,
      studentEmail: enrollment.studentEmail,
      studentPhone: enrollment.studentPhone,
      institution: enrollment.institution,
      placeOfSupply: enrollment.placeOfSupply,
      lines,
      credits: enrollment.credits,
      subtotalCents: enrollment.subtotalCents,
      taxCents: enrollment.taxCents,
      totalCents: enrollment.totalCents,
      cgstCents: gst.cgstCents ?? Math.floor(enrollment.taxCents / 2),
      sgstCents: gst.sgstCents ?? enrollment.taxCents - Math.floor(enrollment.taxCents / 2),
      razorpayPaymentId: enrollment.razorpayPaymentId,
      razorpayOrderId: enrollment.razorpayOrderId,
      paymentOutcome: enrollment.paymentOutcome,
      verifyUrl
    });

    const filename = sanitizePdfFilename(`SKUAST-K-Tax-Invoice-${enrollment.invoiceNumber}.pdf`);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (err) {
    logger.error({ err, event: "certificate_invoice_pdf_failed", enrollmentId: id }, "certificate invoice PDF failed");
    return NextResponse.json({ error: "Could not generate invoice PDF." }, { status: 500 });
  }
}
