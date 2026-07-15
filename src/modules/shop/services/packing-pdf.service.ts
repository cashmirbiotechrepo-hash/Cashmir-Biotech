import "server-only";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  PDF,
  companyBlock,
  drawRect,
  embedBarcodePng,
  embedBrandLogo,
  embedQrPng,
  siteBaseUrl,
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

/** Branded warehouse packing slip — no prices. */
export async function buildPackingSlipPdf(input: PackingSlipInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PDF.page.w, PDF.page.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const company = companyBlock();
  const m = PDF.margin;
  const contentW = PDF.page.w - m * 2;

  // Header band
  const headerH = 70;
  drawRect(page, 0, PDF.page.h - headerH, PDF.page.w, headerH, PDF.ink);
  drawRect(page, 0, PDF.page.h - headerH - 3, PDF.page.w, 3, PDF.gold);

  const logo = await embedBrandLogo(doc);
  if (logo) {
    const logoH = 42;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: m,
      y: PDF.page.h - headerH + (headerH - logoH) / 2,
      width: Math.min(logoW, 110),
      height: logoH
    });
  }

  page.drawText("PACKING SLIP", {
    x: PDF.page.w - m - bold.widthOfTextAtSize("PACKING SLIP", 16),
    y: PDF.page.h - 34,
    size: 16,
    font: bold,
    color: PDF.white
  });
  page.drawText("NO PRICES - WAREHOUSE COPY", {
    x: PDF.page.w - m - font.widthOfTextAtSize("NO PRICES - WAREHOUSE COPY", 8),
    y: PDF.page.h - 50,
    size: 8,
    font,
    color: PDF.gold
  });

  let y = PDF.page.h - headerH - 26;

  // Order + barcode
  page.drawText(input.orderNumber, { x: m, y, size: 14, font: bold, color: PDF.ink });
  y -= 14;
  page.drawText(
    `Placed ${input.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}  |  Lot ${input.batchLabel.slice(0, 36)}`,
    { x: m, y, size: 9, font, color: PDF.mute }
  );

  const barcode = await embedBarcodePng(doc, input.orderNumber);
  if (barcode) {
    const bw = 220;
    const bh = (barcode.height / barcode.width) * bw;
    page.drawImage(barcode, {
      x: PDF.page.w - m - bw,
      y: PDF.page.h - headerH - 18 - bh,
      width: bw,
      height: bh
    });
  }

  y -= 36;

  // Ship to + Dispatch cards
  const cardH = 96;
  const cardW = (contentW - 12) / 2;
  drawRect(page, m, y - cardH + 14, cardW, cardH, PDF.pearl, { color: PDF.line });
  drawRect(page, m + cardW + 12, y - cardH + 14, cardW, cardH, PDF.pearl, { color: PDF.line });

  let ly = y;
  page.drawText("SHIP TO", { x: m + 10, y: ly, size: 8, font: bold, color: PDF.gold });
  ly -= 14;
  const shipName = (input.shippingAddress.fullName || input.customerName || "Customer").slice(0, 40);
  page.drawText(shipName, { x: m + 10, y: ly, size: 11, font: bold, color: PDF.ink });
  ly -= 13;
  for (const line of [
    input.shippingAddress.line1,
    input.shippingAddress.line2,
    [input.shippingAddress.city, input.shippingAddress.state, input.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", "),
    input.shippingAddress.phone || input.customerPhone,
    input.customerEmail
  ].filter(Boolean) as string[]) {
    page.drawText(String(line).slice(0, 40), { x: m + 10, y: ly, size: 8, font, color: PDF.mute });
    ly -= 11;
  }

  let ry = y;
  const rx = m + cardW + 22;
  page.drawText("DISPATCH", { x: rx, y: ry, size: 8, font: bold, color: PDF.gold });
  ry -= 14;
  const dispatchRows = [
    ["Courier", input.carrier || "—"],
    ["Tracking", input.trackingNumber || "Assign at dispatch"],
    ["Packed by", "______________"],
    ["QC check", "______________"],
    ["Dispatch time", "______________"]
  ] as const;
  for (const [label, value] of dispatchRows) {
    page.drawText(`${label}:`, { x: rx, y: ry, size: 8, font: bold, color: PDF.mute });
    page.drawText(String(value).slice(0, 28), { x: rx + 72, y: ry, size: 8, font, color: PDF.ink });
    ry -= 12;
  }

  y -= cardH + 12;

  // Items table
  drawRect(page, m, y - 6, contentW, 22, PDF.ink);
  page.drawText("#", { x: m + 8, y, size: 8, font: bold, color: PDF.white });
  page.drawText("PRODUCT", { x: m + 28, y, size: 8, font: bold, color: PDF.white });
  page.drawText("SKU", { x: m + 260, y, size: 8, font: bold, color: PDF.white });
  page.drawText("LOT / BATCH", { x: m + 340, y, size: 8, font: bold, color: PDF.white });
  page.drawText("QTY", { x: m + 470, y, size: 8, font: bold, color: PDF.white });
  page.drawText("OK", { x: m + 505, y, size: 8, font: bold, color: PDF.white });
  y -= 26;

  let idx = 1;
  let units = 0;
  for (const item of input.items) {
    if (y < 160) break;
    units += item.quantity;
    const nameLines = wrapText(item.productName, 220, bold, 10);
    page.drawText(String(idx), { x: m + 8, y, size: 9, font, color: PDF.mute });
    page.drawText(nameLines[0]!.slice(0, 36), { x: m + 28, y, size: 10, font: bold, color: PDF.ink });
    page.drawText((item.sku || "—").slice(0, 14), { x: m + 260, y, size: 8, font, color: PDF.mute });
    page.drawText((item.lotCodes || input.batchLabel).slice(0, 18), {
      x: m + 340,
      y,
      size: 8,
      font,
      color: PDF.mute
    });
    page.drawText(String(item.quantity), { x: m + 470, y, size: 11, font: bold, color: PDF.ink });
    page.drawRectangle({
      x: m + 508,
      y: y - 2,
      width: 12,
      height: 12,
      borderColor: PDF.line,
      borderWidth: 0.8
    });
    y -= 14;
    if (item.sizeLabel || nameLines[1]) {
      page.drawText((item.sizeLabel || nameLines[1] || "").slice(0, 40), {
        x: m + 28,
        y,
        size: 8,
        font,
        color: PDF.mute
      });
      y -= 12;
    }
    page.drawLine({
      start: { x: m, y: y + 4 },
      end: { x: m + contentW, y: y + 4 },
      thickness: 0.4,
      color: PDF.line
    });
    y -= 8;
    idx += 1;
  }

  y -= 4;
  page.drawText(`Total units to pack: ${units}`, {
    x: m,
    y,
    size: 10,
    font: bold,
    color: PDF.ink
  });

  y -= 28;

  // Workflow checklist
  drawRect(page, m, y - 70, contentW, 82, PDF.pearl, { color: PDF.line });
  page.drawText("FULFILLMENT CHECKLIST", {
    x: m + 10,
    y,
    size: 8,
    font: bold,
    color: PDF.gold
  });
  y -= 14;
  const checks = [
    "Pick correct SKU / lot against this slip",
    "Verify seal integrity and label lot code",
    "Include GST invoice + CoA if required",
    "Photograph / scan tracking before handoff"
  ];
  for (const c of checks) {
    page.drawRectangle({
      x: m + 10,
      y: y - 1,
      width: 9,
      height: 9,
      borderColor: PDF.ink,
      borderWidth: 0.7
    });
    page.drawText(c, { x: m + 26, y, size: 8, font, color: PDF.ink });
    y -= 13;
  }

  // Footer QR
  const verifyUrl = input.confirmationToken
    ? `${siteBaseUrl()}/order/${input.orderNumber}?t=${input.confirmationToken}`
    : `${siteBaseUrl()}/order/lookup`;
  const qr = await embedQrPng(doc, verifyUrl, 100);

  drawRect(page, 0, 0, PDF.page.w, 96, PDF.ink);
  page.drawText("Scan to verify authenticity / open order", {
    x: m,
    y: 72,
    size: 8,
    font: bold,
    color: PDF.gold
  });
  page.drawText(`${company.name}  |  ${company.support}  |  ${company.phone}`, {
    x: m,
    y: 56,
    size: 8,
    font,
    color: PDF.white
  });
  page.drawText("Customer receiving copy - retain with shipment records.", {
    x: m,
    y: 42,
    size: 7,
    font,
    color: PDF.gold
  });
  page.drawText(`Document ID ${input.orderNumber} | ${new Date().toLocaleString("en-IN")}`, {
    x: m,
    y: 28,
    size: 7,
    font,
    color: PDF.white
  });

  if (qr) {
    const q = 64;
    page.drawImage(qr, { x: PDF.page.w - m - q, y: 16, width: q, height: q });
  }

  return doc.save();
}
