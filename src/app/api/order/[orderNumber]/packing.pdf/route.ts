import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { getOrderInvoiceByToken } from "@/modules/shop/services/order.service";
import { batchLabelForOrder } from "@/modules/shop/services/order-ops.service";
import { provenanceLabelForItems } from "@/modules/admin/services/inventory-lots.service";

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
  };
  const fallback = batchLabelForOrder(order.orderNumber, order.createdAt);
  const batch = provenanceLabelForItems(order.items, fallback);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const mute = rgb(0.45, 0.45, 0.48);
  let y = 780;

  const write = (text: string, x: number, size: number, f = font, color = ink) => {
    page.drawText(text, { x, y, size, font: f, color });
  };

  write("CASHMIR BIOTECH", 48, 14, bold);
  write("Packing slip — NO PRICES", 48, 10, font, mute);
  y -= 22;
  write(`Order ${order.orderNumber}`, 48, 11, bold);
  write(`Lot ${batch.slice(0, 40)}`, 280, 10, bold);
  y -= 28;
  write("Ship to", 48, 9, bold, mute);
  y -= 14;
  write((addr.fullName || order.customerName || "Customer").slice(0, 48), 48, 10, bold);
  y -= 12;
  for (const line of [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", "),
    addr.phone
  ]) {
    if (!line) continue;
    write(String(line).slice(0, 60), 48, 9, font, mute);
    y -= 12;
  }
  y -= 16;
  write("Item", 48, 9, bold, mute);
  write("Lot", 300, 9, bold, mute);
  write("Qty", 480, 9, bold, mute);
  y -= 8;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.82) });
  y -= 16;
  for (const item of order.items) {
    if (y < 80) break;
    write(item.productName.slice(0, 36), 48, 10);
    write((item.lotCodes || "—").slice(0, 28), 300, 9, font, mute);
    write(String(item.quantity), 480, 10);
    y -= 14;
  }
  y -= 24;
  write("QC: Pass before seal", 48, 9, font, mute);
  y -= 14;
  write("Customer copy — for receiving records.", 48, 8, font, mute);

  const pdf = await doc.save();
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.orderNumber}-packing-slip.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
