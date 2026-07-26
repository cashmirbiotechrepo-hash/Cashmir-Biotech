import "server-only";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  DOC,
  PDF,
  drawDocFooter,
  drawDocHeader,
  drawHairline,
  drawMarkCircle,
  embedBarcodePng,
  wrapText
} from "@/modules/shop/services/pdf-brand";

export type PackingSlipLine = {
  productName: string;
  quantity: number;
  sku?: string;
  lotCodes?: string;
  sizeLabel?: string;
};

export type PackingSlipInput = {
  orderNumber: string;
  createdAt: Date;
  batchLabel: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone?: string | null;
  shippingAddress: {
    fullName?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items: PackingSlipLine[];
  carrier?: string | null;
  trackingNumber?: string | null;
  confirmationToken?: string;
};

/** Warehouse packing slip — no prices; print-safe QC marks. */
export async function buildPackingSlipPdf(input: PackingSlipInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PDF.page.w, PDF.page.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const m = PDF.margin;
  const contentW = PDF.page.w - m * 2;

  let y = await drawDocHeader({
    page,
    doc: pdf,
    font,
    bold,
    title: "PACKING SLIP",
    number: input.orderNumber,
    metaLines: [
      `Placed ${input.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
      "Warehouse copy · Prices excluded"
    ]
  });

  const barcode = await embedBarcodePng(pdf, input.orderNumber);
  if (barcode) {
    const bw = 148;
    const bh = (barcode.height / barcode.width) * bw;
    page.drawImage(barcode, {
      x: PDF.page.w - m - bw,
      y: y - bh,
      width: bw,
      height: bh
    });
    y -= bh + 16;
  }

  // Ship to | Fulfilment
  const mid = m + contentW / 2;
  page.drawText("SHIP TO", { x: m, y, size: DOC.label, font: bold, color: PDF.mute });
  page.drawText("FULFILMENT", { x: mid + 12, y, size: DOC.label, font: bold, color: PDF.mute });

  let ly = y - 14;
  const shipName = (input.shippingAddress.fullName || input.customerName || "Customer").slice(0, 48);
  page.drawText(shipName, { x: m, y: ly, size: DOC.body, font: bold, color: PDF.ink });
  ly -= 12;
  for (const line of [
    input.shippingAddress.line1,
    input.shippingAddress.line2,
    [input.shippingAddress.city, input.shippingAddress.state, input.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", "),
    input.shippingAddress.phone || input.customerPhone,
    input.customerEmail
  ].filter(Boolean) as string[]) {
    page.drawText(String(line).slice(0, 52), { x: m, y: ly, size: DOC.label, font, color: PDF.mute });
    ly -= 11;
  }

  let ry = y - 14;
  const fulfilment: Array<[string, string]> = [
    ["Courier", input.carrier || "—"],
    ["Tracking", input.trackingNumber || "Assign at dispatch"],
    ["Lot", input.batchLabel],
    ["Packed by", "____________________"],
    ["Checked by", "____________________"]
  ];
  for (const [label, value] of fulfilment) {
    page.drawText(label, { x: mid + 12, y: ry, size: DOC.label, font, color: PDF.mute });
    page.drawText(String(value).slice(0, 34), {
      x: mid + 78,
      y: ry,
      size: DOC.label,
      font,
      color: PDF.ink
    });
    ry -= 12;
  }

  y = Math.min(ly, ry) - 16;
  drawHairline(page, m, y, PDF.page.w - m);
  y -= 18;

  // Table: MARK | PRODUCT | LOT | QTY
  const cMark = m + 6;
  const cProd = m + contentW * 0.1;
  const cLot = m + contentW * 0.68;
  const cQty = PDF.page.w - m;

  page.drawText("MARK", { x: cMark, y, size: DOC.tableHead, font: bold, color: PDF.mute });
  page.drawText("PRODUCT", { x: cProd, y, size: DOC.tableHead, font: bold, color: PDF.mute });
  page.drawText("LOT", { x: cLot, y, size: DOC.tableHead, font: bold, color: PDF.mute });
  page.drawText("QTY", {
    x: cQty - bold.widthOfTextAtSize("QTY", DOC.tableHead),
    y,
    size: DOC.tableHead,
    font: bold,
    color: PDF.mute
  });
  y -= 8;
  drawHairline(page, m, y, PDF.page.w - m, 0.6, PDF.ink);
  y -= 16;

  let units = 0;
  const footerReserve = 120;
  for (const item of input.items) {
    if (y < footerReserve) break;
    units += item.quantity;
    drawMarkCircle(page, cMark + 4, y + 2, 8.5);

    const nameLines = wrapText(item.productName, contentW * 0.52, font, DOC.body);
    page.drawText(nameLines[0]!, { x: cProd, y, size: DOC.body, font: bold, color: PDF.ink });

    const lot = (item.lotCodes || input.batchLabel).slice(0, 22);
    page.drawText(lot, { x: cLot, y, size: DOC.body, font, color: PDF.ink });

    const qty = String(item.quantity);
    page.drawText(qty, {
      x: cQty - bold.widthOfTextAtSize(qty, DOC.value),
      y,
      size: DOC.value,
      font: bold,
      color: PDF.ink
    });

    y -= 12;
    if (item.sizeLabel || nameLines[1]) {
      page.drawText((item.sizeLabel || nameLines[1] || "").slice(0, 56), {
        x: cProd,
        y,
        size: DOC.label,
        font,
        color: PDF.mute
      });
      y -= 11;
    }
    drawHairline(page, m, y + 4, PDF.page.w - m, 0.4, PDF.line);
    y -= 10;
  }

  y -= 4;
  page.drawText(`Total units to pack: ${units}`, {
    x: m,
    y,
    size: DOC.body,
    font: bold,
    color: PDF.ink
  });
  y -= 24;

  drawHairline(page, m, y, PDF.page.w - m);
  y -= 14;
  page.drawText("PACKING INSTRUCTIONS", { x: m, y, size: DOC.label, font: bold, color: PDF.mute });
  y -= 12;
  for (const line of [
    "Include the usage guide and invoice copy when requested.",
    "This warehouse copy must not be inserted into the customer's parcel."
  ]) {
    page.drawText(line, { x: m, y, size: DOC.label, font, color: PDF.mute });
    y -= 11;
  }

  drawDocFooter({
    page,
    font,
    bold,
    docLabel: `Packing slip ${input.orderNumber}`
  });

  return pdf.save();
}
