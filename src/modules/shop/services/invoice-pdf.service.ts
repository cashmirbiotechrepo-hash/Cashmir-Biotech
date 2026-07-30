import "server-only";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  DOC,
  PDF,
  companyBlock,
  drawDocFooter,
  drawDocHeader,
  drawHairline,
  formatInrPdf,
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

function statusLabel(status: InvoicePdfInput["paymentStatus"]) {
  switch (status) {
    case "paid":
      return { label: "PAID", color: PDF.success };
    case "refunded":
      return { label: "REFUNDED", color: PDF.warn };
    case "partially_refunded":
      return { label: "PARTIAL REFUND", color: PDF.warn };
    case "failed":
      return { label: "FAILED", color: PDF.warn };
    case "unpaid":
    case "pending":
      return { label: "UNPAID", color: PDF.warn };
    default:
      return { label: "ISSUED", color: PDF.mute };
  }
}

function rightText(
  page: import("pdf-lib").PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: import("pdf-lib").PDFFont,
  color = PDF.ink
) {
  page.drawText(text, {
    x: rightX - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color
  });
}

/** Builds a restrained GST tax invoice PDF (A4). */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PDF.page.w, PDF.page.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const company = companyBlock();
  const m = PDF.margin;
  const contentW = PDF.page.w - m * 2;
  const gstin = input.gstin || company.gstin;
  const status = statusLabel(input.paymentStatus ?? "paid");

  let y = await drawDocHeader({
    page,
    doc: pdf,
    font,
    bold,
    title: "TAX INVOICE",
    number: input.invoiceNumber,
    metaLines: [
      `Issued ${input.issuedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
      `Order ${input.orderNumber}`
    ]
  });

  if (company.demoMode && !input.gstin) {
    page.drawText("Demo invoice — GST registration not configured", {
      x: m,
      y,
      size: DOC.label,
      font: bold,
      color: PDF.warn
    });
    y -= 18;
  }

  // Status as plain text (no pill)
  page.drawText(status.label, {
    x: m,
    y,
    size: DOC.label,
    font: bold,
    color: status.color
  });
  y -= 22;

  // Seller | Bill to | Metadata — same baseline
  const colW = contentW / 3;
  const col2 = m + colW;
  const col3 = m + colW * 2;
  const blockTop = y;

  page.drawText("SOLD BY", { x: m, y: blockTop, size: DOC.label, font: bold, color: PDF.mute });
  page.drawText("BILL TO", { x: col2 + 8, y: blockTop, size: DOC.label, font: bold, color: PDF.mute });
  page.drawText("DETAILS", { x: col3 + 8, y: blockTop, size: DOC.label, font: bold, color: PDF.mute });

  let ly = blockTop - 14;
  page.drawText(company.name, { x: m, y: ly, size: DOC.body, font: bold, color: PDF.ink });
  ly -= 11;
  for (const line of company.addressLines) {
    page.drawText(line, { x: m, y: ly, size: DOC.label, font, color: PDF.mute });
    ly -= 10;
  }
  if (gstin) {
    page.drawText(`GSTIN ${gstin}`, { x: m, y: ly, size: DOC.label, font, color: PDF.mute });
    ly -= 10;
  }
  if (company.pan) {
    page.drawText(`PAN ${company.pan}`, { x: m, y: ly, size: DOC.label, font, color: PDF.mute });
    ly -= 10;
  }
  if (company.cin) {
    page.drawText(`CIN ${company.cin}`, { x: m, y: ly, size: DOC.label, font, color: PDF.mute });
    ly -= 10;
  }
  page.drawText(company.email, { x: m, y: ly, size: DOC.label, font, color: PDF.mute });
  ly -= 10;
  page.drawText(company.phone, { x: m, y: ly, size: DOC.label, font, color: PDF.mute });

  let by = blockTop - 14;
  const billName = (input.shippingAddress.fullName || input.customerName || "Customer").slice(0, 48);
  page.drawText(billName, { x: col2 + 8, y: by, size: DOC.body, font: bold, color: PDF.ink });
  by -= 11;
  const billLines = [
    input.shippingAddress.line1,
    input.shippingAddress.line2,
    [input.shippingAddress.city, input.shippingAddress.state, input.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", "),
    input.shippingAddress.country,
    input.shippingAddress.phone || input.customerPhone,
    input.customerEmail
  ].filter(Boolean) as string[];
  for (const line of billLines) {
    for (const wrapped of wrapText(String(line), colW - 16, font, DOC.label)) {
      page.drawText(wrapped, { x: col2 + 8, y: by, size: DOC.label, font, color: PDF.mute });
      by -= 10;
    }
  }

  let my = blockTop - 14;
  const details: Array<[string, string]> = [
    ["Payment", status.label],
    ["Method", input.paymentMethod || "Razorpay"],
    [
      "Paid",
      input.paidAt
        ? input.paidAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : "—"
    ]
  ];
  if (input.placeOfSupply) details.push(["Supply", input.placeOfSupply]);
  if (input.razorpayPaymentId) details.push(["Payment ID", input.razorpayPaymentId]);
  const labelColW = 58;
  for (const [label, value] of details) {
    page.drawText(label, { x: col3 + 8, y: my, size: DOC.label, font, color: PDF.mute });
    const valueColor = label === "Payment" ? status.color : PDF.ink;
    const lines = wrapText(value, colW - labelColW - 12, font, DOC.label);
    let vx = my;
    for (let i = 0; i < lines.length; i++) {
      page.drawText(lines[i]!, {
        x: col3 + 8 + labelColW,
        y: vx,
        size: DOC.label,
        font,
        color: valueColor
      });
      vx -= 10;
    }
    my = vx - 4;
  }

  y = Math.min(ly, by, my) - 16;
  drawHairline(page, m, y, PDF.page.w - m);
  y -= 18;

  // Table
  const colDesc = m;
  const colQty = m + contentW * 0.58;
  const colRate = m + contentW * 0.72;
  const colAmt = m + contentW;

  page.drawText("DESCRIPTION", { x: colDesc, y, size: DOC.tableHead, font: bold, color: PDF.mute });
  page.drawText("QTY", {
    x: colQty - bold.widthOfTextAtSize("QTY", DOC.tableHead),
    y,
    size: DOC.tableHead,
    font: bold,
    color: PDF.mute
  });
  page.drawText("RATE", {
    x: colRate - bold.widthOfTextAtSize("RATE", DOC.tableHead),
    y,
    size: DOC.tableHead,
    font: bold,
    color: PDF.mute
  });
  page.drawText("AMOUNT", {
    x: colAmt - bold.widthOfTextAtSize("AMOUNT", DOC.tableHead),
    y,
    size: DOC.tableHead,
    font: bold,
    color: PDF.mute
  });
  y -= 8;
  drawHairline(page, m, y, PDF.page.w - m, 0.6, PDF.ink);
  y -= 14;

  const hsn = input.hsn || "21069099";
  const footerReserve = 110;
  for (const line of input.lines) {
    if (y < footerReserve + 80) break;
    const rate = line.unitPriceCents ?? Math.round(line.amountCents / Math.max(1, line.qty));
    const nameLines = wrapText(line.description, contentW * 0.52, font, DOC.body);
    page.drawText(nameLines[0]!, {
      x: colDesc,
      y,
      size: DOC.body,
      font: bold,
      color: PDF.ink
    });
    rightText(page, String(line.qty), colQty, y, DOC.body, font);
    rightText(page, formatInrPdf(rate), colRate, y, DOC.body, font);
    rightText(page, formatInrPdf(line.amountCents), colAmt, y, DOC.body, bold);
    y -= 12;

    const meta = [line.sku, line.lot ? `Lot ${line.lot}` : null, `HSN ${line.hsn || hsn}`]
      .filter(Boolean)
      .join("  ·  ");
    if (meta) {
      page.drawText(meta, { x: colDesc, y, size: DOC.label, font, color: PDF.mute });
      y -= 11;
    }
    if (nameLines[1]) {
      page.drawText(nameLines[1], { x: colDesc, y, size: DOC.label, font, color: PDF.mute });
      y -= 11;
    }
    drawHairline(page, m, y + 4, PDF.page.w - m, 0.4, PDF.line);
    y -= 8;
  }

  y -= 8;

  // Totals
  const totalsX = m + contentW * 0.55;
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
  } else if (input.taxCents > 0) {
    rows.push({ label: "Tax (GST)", value: formatInrPdf(input.taxCents) });
  }

  for (const row of rows) {
    page.drawText(row.label, { x: totalsX, y, size: DOC.body, font, color: PDF.mute });
    rightText(page, row.value, colAmt, y, DOC.body, font);
    y -= 13;
  }

  drawHairline(page, totalsX, y + 6, PDF.page.w - m, 0.7, PDF.ink);
  y -= 6;
  page.drawText("TOTAL DUE", { x: totalsX, y, size: DOC.value, font: bold, color: PDF.ink });
  rightText(page, formatInrPdf(input.totalCents), colAmt, y, DOC.total, bold);
  y -= 28;

  // Note — rule + text, no card
  if (y > footerReserve + 40) {
    drawHairline(page, m, y, PDF.page.w - m);
    y -= 14;
    page.drawText("NOTE", { x: m, y, size: DOC.label, font: bold, color: PDF.mute });
    y -= 12;
    page.drawText(
      "This is a computer-generated tax invoice. Payment confirmation appears above when captured.",
      { x: m, y, size: DOC.label, font, color: PDF.mute }
    );
  }

  drawDocFooter({
    page,
    font,
    bold,
    docLabel: `Invoice ${input.invoiceNumber}`
  });

  return pdf.save();
}
