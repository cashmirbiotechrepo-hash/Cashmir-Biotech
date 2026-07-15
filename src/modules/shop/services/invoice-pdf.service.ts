import "server-only";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  BRAND_TRUST,
  PDF,
  companyBlock,
  drawRect,
  embedBrandLogo,
  embedQrPng,
  formatInrPdf,
  siteBaseUrl,
  wrapText
} from "@/modules/shop/services/pdf-brand";

export type InvoicePdfLine = {
  description: string;
  qty: number;
  amountCents: number;
  unitPriceCents?: number;
  sku?: string;
  lot?: string;
  hsn?: string;
};

export type InvoicePdfInput = {
  invoiceNumber: string;
  issuedAt: Date;
  orderNumber: string;
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
  lines: InvoicePdfLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  shippingCents?: number;
  discountCents?: number;
  gstin?: string;
  cgstCents?: number;
  sgstCents?: number;
  igstCents?: number;
  placeOfSupply?: string;
  hsn?: string;
  paymentStatus?: "paid" | "unpaid" | "refunded" | "partially_refunded" | "failed" | "pending";
  paymentMethod?: string;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  paidAt?: Date | null;
  confirmationToken?: string;
};

function statusStyle(status: InvoicePdfInput["paymentStatus"]) {
  switch (status) {
    case "paid":
      return { label: "PAID", bg: PDF.successBg, fg: PDF.success };
    case "refunded":
    case "partially_refunded":
      return {
        label: status === "refunded" ? "REFUNDED" : "PARTIAL REFUND",
        bg: PDF.warnBg,
        fg: PDF.warn
      };
    case "failed":
      return { label: "FAILED", bg: PDF.warnBg, fg: PDF.warn };
    case "unpaid":
    case "pending":
      return { label: "UNPAID", bg: PDF.warnBg, fg: PDF.warn };
    default:
      return { label: "ISSUED", bg: PDF.pearl, fg: PDF.ink };
  }
}

/** Builds a branded GST tax invoice PDF (A4). */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PDF.page.w, PDF.page.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const company = companyBlock();
  const m = PDF.margin;
  const contentW = PDF.page.w - m * 2;
  let y = PDF.page.h;

  const write = (
    text: string,
    x: number,
    size: number,
    f = font,
    color = PDF.ink,
    maxW?: number
  ) => {
    const t = maxW
      ? text.length > 80
        ? wrapText(text, maxW, f, size)[0]!.slice(0, 90)
        : text
      : text;
    page.drawText(t, { x, y, size, font: f, color });
  };

  // ——— Header ———
  const headerH = 78;
  drawRect(page, 0, PDF.page.h - headerH, PDF.page.w, headerH, PDF.ink);
  y = PDF.page.h - 18;

  const logo = await embedBrandLogo(doc);
  if (logo) {
    const logoH = 46;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: m,
      y: PDF.page.h - headerH + (headerH - logoH) / 2,
      width: Math.min(logoW, 120),
      height: logoH
    });
  } else {
    page.drawText("Cashmir Biotech", {
      x: m,
      y: PDF.page.h - 42,
      size: 14,
      font: bold,
      color: PDF.white
    });
  }

  page.drawText("GST TAX INVOICE", {
    x: PDF.page.w - m - bold.widthOfTextAtSize("GST TAX INVOICE", 16),
    y: PDF.page.h - 36,
    size: 16,
    font: bold,
    color: PDF.white
  });
  page.drawText(company.name, {
    x: PDF.page.w - m - font.widthOfTextAtSize(company.name, 8),
    y: PDF.page.h - 52,
    size: 8,
    font,
    color: PDF.gold
  });

  // Gold rule under header
  drawRect(page, 0, PDF.page.h - headerH - 3, PDF.page.w, 3, PDF.gold);

  y = PDF.page.h - headerH - 28;

  // Demo banner when GSTIN missing
  const gstin = input.gstin || company.gstin;
  if (company.demoMode && !input.gstin) {
    drawRect(page, m, y - 6, contentW, 22, PDF.warnBg, { color: PDF.warn, thickness: 0.6 });
    page.drawText("DEMO / TEST INVOICE - GST registration details not yet configured", {
      x: m + 8,
      y: y,
      size: 8,
      font: bold,
      color: PDF.warn
    });
    y -= 30;
  }

  // Meta row
  const status = statusStyle(input.paymentStatus ?? "paid");
  const badgeW = bold.widthOfTextAtSize(status.label, 9) + 16;
  drawRect(page, PDF.page.w - m - badgeW, y - 4, badgeW, 16, status.bg, {
    color: status.fg,
    thickness: 0.6
  });
  page.drawText(status.label, {
    x: PDF.page.w - m - badgeW + 8,
    y: y,
    size: 9,
    font: bold,
    color: status.fg
  });

  write(input.invoiceNumber, m, 13, bold);
  y -= 14;
  write(`Issued ${input.issuedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`, m, 9, font, PDF.mute);
  y -= 12;
  write(`Order ${input.orderNumber}`, m, 9, font, PDF.mute);
  if (gstin) {
    write(`GSTIN ${gstin}`, m + 220, 9, font, PDF.mute);
  }
  if (input.placeOfSupply) {
    y -= 12;
    write(`Place of supply: ${input.placeOfSupply}`, m, 9, font, PDF.mute);
  }

  y -= 22;

  // Bill to / From cards
  const cardH = 78;
  const cardW = (contentW - 12) / 2;
  drawRect(page, m, y - cardH + 12, cardW, cardH, PDF.pearl, { color: PDF.line });
  drawRect(page, m + cardW + 12, y - cardH + 12, cardW, cardH, PDF.pearl, { color: PDF.line });

  let leftY = y;
  page.drawText("BILL TO", { x: m + 10, y: leftY, size: 8, font: bold, color: PDF.gold });
  leftY -= 13;
  const billName = (input.shippingAddress.fullName || input.customerName || "Customer").slice(0, 42);
  page.drawText(billName, { x: m + 10, y: leftY, size: 10, font: bold, color: PDF.ink });
  leftY -= 12;
  const addrLines = [
    input.shippingAddress.line1,
    input.shippingAddress.line2,
    [input.shippingAddress.city, input.shippingAddress.state, input.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", "),
    input.shippingAddress.phone || input.customerPhone,
    input.customerEmail
  ].filter(Boolean) as string[];
  for (const line of addrLines.slice(0, 4)) {
    page.drawText(String(line).slice(0, 42), {
      x: m + 10,
      y: leftY,
      size: 8,
      font,
      color: PDF.mute
    });
    leftY -= 11;
  }

  let rightY = y;
  const fromX = m + cardW + 22;
  page.drawText("FROM", { x: fromX, y: rightY, size: 8, font: bold, color: PDF.gold });
  rightY -= 13;
  page.drawText(company.name, { x: fromX, y: rightY, size: 10, font: bold, color: PDF.ink });
  rightY -= 12;
  for (const line of [company.location, company.email, company.phone, gstin ? `GSTIN ${gstin}` : null].filter(
    Boolean
  ) as string[]) {
    page.drawText(line.slice(0, 42), { x: fromX, y: rightY, size: 8, font, color: PDF.mute });
    rightY -= 11;
  }

  y -= cardH + 8;

  // Items table header
  const colItem = m;
  const colSku = m + 220;
  const colQty = m + 320;
  const colRate = m + 370;
  const colAmt = m + 455;

  drawRect(page, m, y - 6, contentW, 20, PDF.ink);
  page.drawText("ITEM", { x: colItem + 8, y: y, size: 8, font: bold, color: PDF.white });
  page.drawText("SKU / LOT", { x: colSku, y: y, size: 8, font: bold, color: PDF.white });
  page.drawText("QTY", { x: colQty, y: y, size: 8, font: bold, color: PDF.white });
  page.drawText("RATE", { x: colRate, y: y, size: 8, font: bold, color: PDF.white });
  page.drawText("AMOUNT", { x: colAmt, y: y, size: 8, font: bold, color: PDF.white });
  y -= 24;

  const hsn = input.hsn || "21069099";
  for (const line of input.lines) {
    if (y < 220) break;
    const rate = line.unitPriceCents ?? Math.round(line.amountCents / Math.max(1, line.qty));
    const nameLines = wrapText(line.description, 200, font, 9);
    page.drawText(nameLines[0]!.slice(0, 40), { x: colItem + 8, y, size: 9, font: bold, color: PDF.ink });
    const meta = [line.sku, line.lot ? `Lot ${line.lot}` : null, `HSN ${line.hsn || hsn}`]
      .filter(Boolean)
      .join(" | ");
    page.drawText((meta || "—").slice(0, 28), { x: colSku, y, size: 7, font, color: PDF.mute });
    page.drawText(String(line.qty), { x: colQty, y, size: 9, font, color: PDF.ink });
    page.drawText(formatInrPdf(rate), { x: colRate, y, size: 8, font, color: PDF.ink });
    page.drawText(formatInrPdf(line.amountCents), { x: colAmt, y, size: 9, font: bold, color: PDF.ink });
    y -= 16;
    if (nameLines[1]) {
      page.drawText(nameLines[1].slice(0, 40), { x: colItem + 8, y, size: 8, font, color: PDF.mute });
      y -= 12;
    }
    page.drawLine({
      start: { x: m, y: y + 4 },
      end: { x: m + contentW, y: y + 4 },
      thickness: 0.4,
      color: PDF.line
    });
    y -= 6;
  }

  y -= 8;

  // Totals panel
  const totalsW = 220;
  const totalsX = PDF.page.w - m - totalsW;
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: "Subtotal", value: formatInrPdf(input.subtotalCents) }
  ];
  if ((input.discountCents ?? 0) > 0) {
    rows.push({ label: "Discount", value: `- ${formatInrPdf(input.discountCents!)}` });
  }
  rows.push({ label: "Shipping", value: formatInrPdf(input.shippingCents ?? 0) });
  if (typeof input.cgstCents === "number" && typeof input.sgstCents === "number") {
    rows.push({ label: "CGST", value: formatInrPdf(input.cgstCents) });
    rows.push({ label: "SGST", value: formatInrPdf(input.sgstCents) });
  } else if ((input.igstCents ?? 0) > 0) {
    rows.push({ label: "IGST", value: formatInrPdf(input.igstCents!) });
  } else {
    rows.push({ label: "Tax (GST incl.)", value: formatInrPdf(input.taxCents) });
  }
  rows.push({ label: "Grand total", value: formatInrPdf(input.totalCents), strong: true });

  const totalsH = rows.length * 16 + 18;
  drawRect(page, totalsX, y - totalsH + 12, totalsW, totalsH, PDF.pearl, { color: PDF.line });
  let ty = y;
  for (const row of rows) {
    const f = row.strong ? bold : font;
    const size = row.strong ? 11 : 9;
    page.drawText(row.label, {
      x: totalsX + 10,
      y: ty,
      size,
      font: f,
      color: row.strong ? PDF.ink : PDF.mute
    });
    const vw = f.widthOfTextAtSize(row.value, size);
    page.drawText(row.value, {
      x: totalsX + totalsW - 10 - vw,
      y: ty,
      size,
      font: f,
      color: PDF.ink
    });
    ty -= 16;
  }
  y -= totalsH + 10;

  // Payment block
  drawRect(page, m, y - 58, contentW, 70, PDF.paper, { color: PDF.line });
  page.drawText("PAYMENT", { x: m + 10, y: y, size: 8, font: bold, color: PDF.gold });
  y -= 14;
  const payBits = [
    `Status: ${status.label}`,
    input.paymentMethod ? `Method: ${input.paymentMethod}` : "Method: Razorpay",
    input.paidAt
      ? `Paid on: ${input.paidAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
      : null,
    input.razorpayPaymentId ? `Txn: ${input.razorpayPaymentId}` : null,
    input.razorpayOrderId ? `Razorpay order: ${input.razorpayOrderId}` : null
  ].filter(Boolean) as string[];
  for (const bit of payBits.slice(0, 4)) {
    page.drawText(bit.slice(0, 70), { x: m + 10, y, size: 8, font, color: PDF.ink });
    y -= 11;
  }

  y -= 18;

  // Trust + support + QR
  const verifyUrl = input.confirmationToken
    ? `${siteBaseUrl()}/order/${input.orderNumber}?t=${input.confirmationToken}`
    : `${siteBaseUrl()}/portal/login`;
  const qr = await embedQrPng(doc, verifyUrl, 96);

  const footerTop = Math.max(y, 130);
  y = footerTop;

  page.drawText("TRUST & QUALITY", { x: m, y, size: 8, font: bold, color: PDF.gold });
  y -= 12;
  for (const line of BRAND_TRUST) {
    page.drawText(`-  ${line}`, { x: m, y, size: 8, font, color: PDF.mute });
    y -= 11;
  }

  y -= 6;
  page.drawText("NEED HELP?", { x: m, y, size: 8, font: bold, color: PDF.gold });
  y -= 12;
  page.drawText(`${company.support}  |  ${company.phone}`, { x: m, y, size: 8, font, color: PDF.ink });
  y -= 11;
  page.drawText(`${siteBaseUrl()}  |  Customer Portal for invoices & CoAs`, {
    x: m,
    y,
    size: 8,
    font,
    color: PDF.mute
  });
  y -= 11;
  page.drawText("Love this formulation? Reorder at cashmirbiotech.com/products", {
    x: m,
    y,
    size: 8,
    font,
    color: PDF.mute
  });

  if (qr) {
    const qSize = 72;
    page.drawImage(qr, {
      x: PDF.page.w - m - qSize,
      y: 48,
      width: qSize,
      height: qSize
    });
    page.drawText("Verify order", {
      x: PDF.page.w - m - qSize,
      y: 38,
      size: 7,
      font: bold,
      color: PDF.mute
    });
  }

  // Bottom authenticity strip
  drawRect(page, 0, 0, PDF.page.w, 28, PDF.ink);
  page.drawText(
    `Computer-generated tax invoice | ${input.invoiceNumber} | Generated ${new Date().toLocaleString("en-IN")}`,
    {
      x: m,
      y: 10,
      size: 7,
      font,
      color: PDF.white
    }
  );

  return doc.save();
}
