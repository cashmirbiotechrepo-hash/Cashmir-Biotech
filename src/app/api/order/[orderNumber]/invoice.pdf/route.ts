import { NextResponse } from "next/server";
import { getOrderInvoiceByToken } from "@/modules/shop/services/order.service";
import { buildInvoicePdf } from "@/modules/shop/services/invoice-pdf.service";
import { sanitizePdfFilename } from "@/modules/shop/services/pdf-brand";
import { PORTAL_STATUS_LABEL } from "@/lib/customer/portal-ui";

export const runtime = "nodejs";

function paymentStatusForOrder(status: string): "paid" | "unpaid" | "refunded" | "partially_refunded" | "failed" | "pending" {
  if (status === "refunded") return "refunded";
  if (status === "partially_refunded") return "partially_refunded";
  if (status === "payment_failed") return "failed";
  if (status === "pending") return "pending";
  if (["paid", "processing", "shipped", "delivered"].includes(status)) return "paid";
  return "unpaid";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const order = await getOrderInvoiceByToken(orderNumber, token);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const invoice = order.invoices[0];
  if (!invoice) {
    return NextResponse.json({ ok: false, error: "Invoice not ready" }, { status: 404 });
  }

  const gst = (invoice.gstDetails ?? {}) as {
    gstin?: string;
    cgstCents?: number;
    sgstCents?: number;
    igstCents?: number;
    placeOfSupply?: string;
    hsn?: string;
    lineItems?: Array<{
      description: string;
      qty: number;
      amountCents: number;
      rateCents?: number;
      hsn?: string;
    }>;
  };

  const lines =
    gst.lineItems?.length && gst.lineItems.length > 0
      ? gst.lineItems.map((l) => ({
          description: l.description,
          qty: l.qty,
          amountCents: l.amountCents,
          unitPriceCents: l.rateCents,
          hsn: l.hsn || gst.hsn
        }))
      : order.items.map((item) => ({
          description: item.productName,
          qty: item.quantity,
          amountCents: item.quantity * item.unitPriceCents,
          unitPriceCents: item.unitPriceCents,
          sku: item.product?.sku || undefined,
          lot: item.lotCodes || undefined,
          hsn: gst.hsn || "21069099"
        }));

  const pdf = await buildInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddress: (order.shippingAddress ?? {}) as {
      fullName?: string;
      phone?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    },
    lines,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents ?? 0,
    gstin: gst.gstin,
    cgstCents: gst.cgstCents,
    sgstCents: gst.sgstCents,
    igstCents: gst.igstCents,
    placeOfSupply: gst.placeOfSupply,
    hsn: gst.hsn,
    paymentStatus: paymentStatusForOrder(order.status),
    paymentMethod: order.razorpayPaymentId?.startsWith("test_skip_")
      ? "Test checkout"
      : order.razorpayPaymentId
        ? "Razorpay"
        : PORTAL_STATUS_LABEL[order.status] ?? "Online",
    razorpayPaymentId: order.razorpayPaymentId || null,
    razorpayOrderId: order.razorpayOrderId,
    paidAt: ["paid", "processing", "shipped", "delivered"].includes(order.status)
      ? order.updatedAt
      : null,
    confirmationToken: order.confirmationToken
  });

  const filename = sanitizePdfFilename(
    `Cashmir-Biotech-Invoice-${invoice.invoiceNumber}.pdf`
  );

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
