import { NextResponse } from "next/server";
import { getOrderInvoiceByToken } from "@/modules/shop/services/order.service";
import { batchLabelForOrder } from "@/modules/shop/services/order-ops.service";
import { provenanceLabelForItems } from "@/modules/admin/services/inventory-lots.service";
import { buildPackingSlipPdf } from "@/modules/shop/services/packing-pdf.service";
import { sanitizePdfFilename } from "@/modules/shop/services/pdf-brand";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await context.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const order = await getOrderInvoiceByToken(orderNumber, token);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const addr = (order.shippingAddress ?? {}) as {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string;
    country?: string;
  };
  const fallback = batchLabelForOrder(order.orderNumber, order.createdAt);
  const batch = provenanceLabelForItems(order.items, fallback);

  const pdf = await buildPackingSlipPdf({
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    batchLabel: batch,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddress: addr,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      sku: item.product?.sku || undefined,
      lotCodes: item.lotCodes || undefined,
      sizeLabel: item.product?.sizeLabel || undefined
    })),
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    confirmationToken: order.confirmationToken
  });

  const filename = sanitizePdfFilename(
    `Cashmir-Biotech-PackingSlip-${order.orderNumber}.pdf`
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
