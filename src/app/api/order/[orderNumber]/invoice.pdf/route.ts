import { NextResponse } from "next/server";
import { getOrderInvoiceByToken } from "@/modules/shop/services/order.service";
import { buildInvoicePdf } from "@/modules/shop/services/invoice-pdf.service";

export const runtime = "nodejs";

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
    placeOfSupply?: string;
    lineItems?: Array<{ description: string; qty: number; amountCents: number }>;
  };

  const lines =
    gst.lineItems?.length && gst.lineItems.length > 0
      ? gst.lineItems
      : order.items.map((item) => ({
          description: item.productName,
          qty: item.quantity,
          amountCents: item.quantity * item.unitPriceCents
        }));

  const pdf = await buildInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    shippingAddress: (order.shippingAddress ?? {}) as {
      fullName?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    },
    lines,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    gstin: gst.gstin,
    cgstCents: gst.cgstCents,
    sgstCents: gst.sgstCents,
    placeOfSupply: gst.placeOfSupply
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
