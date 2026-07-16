import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { embedQrPng, formatInrPdf, wrapText } from "@/modules/shop/services/pdf-brand";
import { CERTIFICATE_ISSUER } from "@/lib/certificate/courses";
import type { CourseLineSnapshot } from "@/lib/certificate/enrollment";

/** Institutional tax invoice — white field, charcoal type, green accents only. */
const PAGE = { w: 595.28, h: 841.89 };
const M = 48;
const CONTENT_W = PAGE.w - M * 2;

const ink = rgb(0.12, 0.12, 0.12);
const mute = rgb(0.45, 0.45, 0.45);
const faint = rgb(0.62, 0.62, 0.62);
const rule = rgb(0.88, 0.88, 0.88);
const ruleStrong = rgb(0.78, 0.78, 0.78);
const accent = rgb(0.12, 0.35, 0.28);
const paidFg = rgb(0.1, 0.42, 0.28);
const paidBg = rgb(0.93, 0.97, 0.94);

export type SkuastInvoiceInput = {
  invoiceNumber: string;
  enrollmentNumber: string;
  issuedAt: Date;
  paidAt: Date | null;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  institution: string;
  placeOfSupply: string;
  lines: CourseLineSnapshot[];
  credits: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  cgstCents: number;
  sgstCents: number;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  paymentOutcome: string;
  verifyUrl: string;
};

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

type Cols = {
  desc: number;
  cr: number;
  gstEnd: number;
  amt: number;
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });
}

function fmtDateTime(d: Date) {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  });
}

function amountWordsInr(cents: number): string {
  const rupees = Math.floor(cents / 100);
  const paise = cents % 100;
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function underThousand(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n]!;
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${underThousand(n % 100)}` : ""}`.trim();
  }

  function toWords(n: number): string {
    if (n === 0) return "Zero";
    const crore = Math.floor(n / 1e7);
    const lakh = Math.floor((n % 1e7) / 1e5);
    const thousand = Math.floor((n % 1e5) / 1e3);
    const rest = n % 1000;
    const parts: string[] = [];
    if (crore) parts.push(`${underThousand(crore)} Crore`);
    if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
    if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
    if (rest) parts.push(underThousand(rest));
    return parts.join(" ");
  }

  const main = `${toWords(rupees)} Rupees`;
  if (paise) return `${main} and ${toWords(paise)} Paise Only`;
  return `${main} Only`;
}

function drawHairline(page: PDFPage, y: number, strong = false) {
  page.drawLine({
    start: { x: M, y },
    end: { x: PAGE.w - M, y },
    thickness: strong ? 0.9 : 0.45,
    color: strong ? ruleStrong : rule
  });
}

function rightText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color = ink
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

function drawMutedBlock(page: PDFPage, text: string, x: number, startY: number, maxW: number, font: PDFFont) {
  const lines = wrapText(text, maxW, font, 8);
  let yy = startY;
  for (const line of lines.slice(0, 4)) {
    page.drawText(line, { x, y: yy, size: 8, font, color: mute });
    yy -= 11;
  }
  return yy;
}

function drawTableHeader(page: PDFPage, fonts: Fonts, y: number, col: Cols) {
  page.drawText("Description", { x: col.desc, y, size: 7, font: fonts.bold, color: faint });
  page.drawText("Cr.", { x: col.cr, y, size: 7, font: fonts.bold, color: faint });
  rightText(page, "Taxable", col.gstEnd - 72, y, 7, fonts.bold, faint);
  rightText(page, "GST", col.gstEnd, y, 7, fonts.bold, faint);
  rightText(page, "Amount", col.amt, y, 7, fonts.bold, faint);
}

function drawContinuationHeader(page: PDFPage, fonts: Fonts, invoiceNumber: string) {
  page.drawText(`${CERTIFICATE_ISSUER.shortName} · Tax Invoice (continued)`, {
    x: M,
    y: PAGE.h - M,
    size: 9,
    font: fonts.bold,
    color: ink
  });
  rightText(page, invoiceNumber, PAGE.w - M, PAGE.h - M, 8, fonts.regular, mute);
  drawHairline(page, PAGE.h - M - 12);
}

function drawFooter(page: PDFPage, fonts: Fonts, pageNum: number, docId: string, generatedAt: Date) {
  drawHairline(page, 52);
  page.drawText(`${CERTIFICATE_ISSUER.website}  ·  ${CERTIFICATE_ISSUER.email}`, {
    x: M,
    y: 38,
    size: 7,
    font: fonts.regular,
    color: faint
  });
  page.drawText(`${docId}  ·  ${fmtDateTime(generatedAt)}  ·  Page ${pageNum}`, {
    x: M,
    y: 26,
    size: 7,
    font: fonts.regular,
    color: faint
  });
}

/** Institutional A4 tax invoice for SKUAST-K certificate enrolments. */
export async function buildSkuastCertificateInvoicePdf(input: SkuastInvoiceInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique)
  };

  const generatedAt = new Date();
  const docId = `DOC-${input.invoiceNumber.replace(/[^A-Za-z0-9]/g, "").slice(-10)}`;
  const qr = await embedQrPng(doc, input.verifyUrl, 88);

  const col: Cols = {
    desc: M,
    cr: M + 300,
    gstEnd: PAGE.w - M - 88,
    amt: PAGE.w - M
  };

  let page = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - M;
  let pageIndex = 1;

  const ensureSpace = (needed: number) => {
    if (y - needed >= 72) return;
    drawFooter(page, fonts, pageIndex, docId, generatedAt);
    pageIndex += 1;
    page = doc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - M;
    drawContinuationHeader(page, fonts, input.invoiceNumber);
    y = PAGE.h - M - 36;
    drawTableHeader(page, fonts, y, col);
    y -= 10;
    drawHairline(page, y, true);
    y -= 18;
  };

  // Thin brand accent — not a green slab
  page.drawLine({
    start: { x: M, y: PAGE.h - 28 },
    end: { x: M + 48, y: PAGE.h - 28 },
    thickness: 2,
    color: accent
  });

  // Issuer
  page.drawText(CERTIFICATE_ISSUER.shortName, {
    x: M,
    y,
    size: 11,
    font: fonts.bold,
    color: accent
  });
  y -= 14;
  for (const line of wrapText(CERTIFICATE_ISSUER.legalName, CONTENT_W * 0.7, fonts.regular, 8)) {
    page.drawText(line, { x: M, y, size: 8, font: fonts.regular, color: mute });
    y -= 10;
  }
  page.drawText(CERTIFICATE_ISSUER.unit, { x: M, y, size: 8, font: fonts.regular, color: mute });
  y -= 10;
  page.drawText(
    `${CERTIFICATE_ISSUER.campus}, ${CERTIFICATE_ISSUER.city} ${CERTIFICATE_ISSUER.pincode}`,
    { x: M, y, size: 8, font: fonts.regular, color: faint }
  );

  // Document title + status
  rightText(page, "TAX INVOICE", PAGE.w - M, PAGE.h - M, 18, fonts.bold, ink);
  rightText(page, "Original for Recipient", PAGE.w - M, PAGE.h - M - 16, 8, fonts.italic, faint);

  const paidLabel = "✓  PAID";
  const paidW = fonts.bold.widthOfTextAtSize(paidLabel, 8) + 16;
  const paidX = PAGE.w - M - paidW;
  const paidY = PAGE.h - M - 42;
  page.drawRectangle({
    x: paidX,
    y: paidY,
    width: paidW,
    height: 18,
    color: paidBg,
    borderColor: rgb(0.78, 0.9, 0.82),
    borderWidth: 0.5
  });
  page.drawText(paidLabel, {
    x: paidX + 8,
    y: paidY + 5.5,
    size: 8,
    font: fonts.bold,
    color: paidFg
  });

  y = Math.min(y, paidY) - 28;
  drawHairline(page, y, true);
  y -= 28;

  // Invoice meta — number is primary
  page.drawText("Invoice number", { x: M, y, size: 7, font: fonts.regular, color: faint });
  page.drawText(input.invoiceNumber, {
    x: M,
    y: y - 14,
    size: 13,
    font: fonts.bold,
    color: ink
  });

  rightText(page, "Invoice date", PAGE.w - M, y, 7, fonts.regular, faint);
  rightText(page, fmtDate(input.issuedAt), PAGE.w - M, y - 14, 10, fonts.bold, ink);
  rightText(page, "Payment date", PAGE.w - M, y - 32, 7, fonts.regular, faint);
  rightText(page, fmtDate(input.paidAt ?? input.issuedAt), PAGE.w - M, y - 46, 10, fonts.bold, ink);

  y -= 70;
  page.drawText("Enrolment reference", { x: M, y, size: 7, font: fonts.regular, color: faint });
  page.drawText(input.enrollmentNumber, {
    x: M,
    y: y - 12,
    size: 9,
    font: fonts.regular,
    color: ink
  });
  page.drawText("Programme", { x: M + 230, y, size: 7, font: fonts.regular, color: faint });
  page.drawText(CERTIFICATE_ISSUER.programmeCode, {
    x: M + 230,
    y: y - 12,
    size: 9,
    font: fonts.regular,
    color: ink
  });

  y -= 36;
  drawHairline(page, y);
  y -= 26;

  // Bill to / Issued by
  const half = CONTENT_W / 2;
  page.drawText("BILL TO", { x: M, y, size: 7, font: fonts.bold, color: faint });
  page.drawText("ISSUED BY", { x: M + half + 8, y, size: 7, font: fonts.bold, color: faint });
  y -= 14;

  page.drawText(input.studentName, { x: M, y, size: 11, font: fonts.bold, color: ink });
  page.drawText(CERTIFICATE_ISSUER.shortName, {
    x: M + half + 8,
    y,
    size: 11,
    font: fonts.bold,
    color: ink
  });
  y -= 13;

  let leftY = y;
  let rightY = y;
  leftY = drawMutedBlock(page, input.studentEmail, M, leftY, half - 16, fonts.regular);
  if (input.studentPhone) leftY = drawMutedBlock(page, input.studentPhone, M, leftY, half - 16, fonts.regular);
  if (input.institution) leftY = drawMutedBlock(page, input.institution, M, leftY, half - 16, fonts.regular);

  rightY = drawMutedBlock(page, CERTIFICATE_ISSUER.unit, M + half + 8, rightY, half - 16, fonts.regular);
  rightY = drawMutedBlock(
    page,
    `${CERTIFICATE_ISSUER.campus}, ${CERTIFICATE_ISSUER.city} ${CERTIFICATE_ISSUER.pincode}`,
    M + half + 8,
    rightY,
    half - 16,
    fonts.regular
  );
  rightY = drawMutedBlock(
    page,
    `Place of supply: ${input.placeOfSupply}`,
    M + half + 8,
    rightY,
    half - 16,
    fonts.regular
  );
  rightY = drawMutedBlock(
    page,
    `SAC / HSN ${CERTIFICATE_ISSUER.sacHsn}`,
    M + half + 8,
    rightY,
    half - 16,
    fonts.regular
  );

  y = Math.min(leftY, rightY) - 20;
  drawHairline(page, y);
  y -= 22;

  // Course table
  page.drawText("Course details", { x: M, y, size: 9, font: fonts.bold, color: ink });
  y -= 16;
  drawTableHeader(page, fonts, y, col);
  y -= 8;
  drawHairline(page, y, true);
  y -= 18;

  for (const line of input.lines) {
    const titleLines = wrapText(line.title, 270, fonts.regular, 9);
    const rowH = 12 + Math.max(0, titleLines.length - 1) * 10;
    ensureSpace(rowH + 24);

    page.drawText(line.code, { x: col.desc, y, size: 7, font: fonts.regular, color: faint });
    page.drawText(titleLines[0] ?? line.title, {
      x: col.desc,
      y: y - 11,
      size: 9,
      font: fonts.regular,
      color: ink
    });
    for (let i = 1; i < titleLines.length; i++) {
      page.drawText(titleLines[i]!, {
        x: col.desc,
        y: y - 11 - i * 10,
        size: 8,
        font: fonts.regular,
        color: mute
      });
    }

    page.drawText(String(line.credits), {
      x: col.cr,
      y: y - 11,
      size: 9,
      font: fonts.regular,
      color: ink
    });
    rightText(page, formatInrPdf(line.taxableCents), col.gstEnd - 72, y - 11, 8, fonts.regular, mute);
    rightText(page, formatInrPdf(line.taxCents), col.gstEnd, y - 11, 8, fonts.regular, mute);
    rightText(page, formatInrPdf(line.feeInclusiveCents), col.amt, y - 11, 9, fonts.bold, ink);

    y -= rowH + 10;
    drawHairline(page, y + 6);
    y -= 6;
  }

  y -= 8;
  page.drawText(
    `Fees inclusive of GST @ 18% · ${input.credits} academic credit${input.credits === 1 ? "" : "s"}`,
    { x: M, y, size: 7.5, font: fonts.italic, color: faint }
  );

  // Totals — typography, not a box
  ensureSpace(130);
  y -= 28;
  const totalsX = PAGE.w - M - 200;

  const totalRow = (label: string, value: string, size = 9, strong = false) => {
    page.drawText(label, {
      x: totalsX,
      y,
      size,
      font: strong ? fonts.bold : fonts.regular,
      color: strong ? ink : mute
    });
    rightText(page, value, PAGE.w - M, y, size, strong ? fonts.bold : fonts.regular, ink);
    y -= strong ? 22 : 16;
  };

  totalRow("Subtotal (taxable)", formatInrPdf(input.subtotalCents));
  totalRow("CGST @ 9%", formatInrPdf(input.cgstCents));
  totalRow("SGST @ 9%", formatInrPdf(input.sgstCents));
  y -= 4;
  drawHairline(page, y + 8);
  y -= 8;
  totalRow("Grand total", formatInrPdf(input.totalCents), 14, true);

  y -= 4;
  page.drawText("Amount in words", { x: M, y, size: 7, font: fonts.regular, color: faint });
  y -= 12;
  for (const w of wrapText(amountWordsInr(input.totalCents), CONTENT_W * 0.55, fonts.regular, 9)) {
    page.drawText(w, { x: M, y, size: 9, font: fonts.regular, color: ink });
    y -= 12;
  }

  // Payment
  ensureSpace(100);
  y -= 14;
  drawHairline(page, y);
  y -= 22;
  page.drawText("Payment details", { x: M, y, size: 9, font: fonts.bold, color: ink });
  y -= 18;

  const payCols = [
    { label: "Gateway", value: "Razorpay" },
    { label: "Transaction ID", value: input.razorpayPaymentId || "—" },
    { label: "Order ID", value: input.razorpayOrderId || "—" },
    {
      label: "Status",
      value: input.paymentOutcome === "gateway_success" ? "Captured" : "Settled"
    }
  ];
  const payW = CONTENT_W / 4;
  for (let i = 0; i < payCols.length; i++) {
    const px = M + i * payW;
    page.drawText(payCols[i]!.label.toUpperCase(), {
      x: px,
      y,
      size: 6.5,
      font: fonts.regular,
      color: faint
    });
    const v = wrapText(payCols[i]!.value, payW - 8, fonts.regular, 8)[0] ?? "—";
    page.drawText(v, { x: px, y: y - 12, size: 8, font: fonts.regular, color: ink });
  }
  y -= 40;

  // Verification + signature
  ensureSpace(140);
  drawHairline(page, y);
  y -= 22;
  page.drawText("Digital verification", { x: M, y, size: 9, font: fonts.bold, color: ink });

  const verifyTop = y - 8;
  const qrSize = 64;
  if (qr) {
    page.drawImage(qr, { x: M, y: verifyTop - qrSize, width: qrSize, height: qrSize });
  }
  page.drawText("Scan to verify authenticity", {
    x: M + 76,
    y: verifyTop - 10,
    size: 8,
    font: fonts.regular,
    color: mute
  });
  page.drawText("Document ID", {
    x: M + 76,
    y: verifyTop - 28,
    size: 7,
    font: fonts.regular,
    color: faint
  });
  page.drawText(docId, {
    x: M + 76,
    y: verifyTop - 40,
    size: 8,
    font: fonts.bold,
    color: ink
  });
  page.drawText("Generated", {
    x: M + 76,
    y: verifyTop - 54,
    size: 7,
    font: fonts.regular,
    color: faint
  });
  page.drawText(fmtDateTime(generatedAt), {
    x: M + 76,
    y: verifyTop - 66,
    size: 8,
    font: fonts.regular,
    color: ink
  });

  const sigX = PAGE.w - M - 160;
  page.drawText("For Continuing Education Cell", {
    x: sigX,
    y: verifyTop - 10,
    size: 7,
    font: fonts.regular,
    color: faint
  });
  page.drawText(CERTIFICATE_ISSUER.shortName, {
    x: sigX,
    y: verifyTop - 22,
    size: 8,
    font: fonts.bold,
    color: ink
  });
  page.drawLine({
    start: { x: sigX, y: verifyTop - 52 },
    end: { x: PAGE.w - M, y: verifyTop - 52 },
    thickness: 0.5,
    color: ruleStrong
  });
  page.drawText("Authorised Signatory", {
    x: sigX,
    y: verifyTop - 64,
    size: 8,
    font: fonts.bold,
    color: ink
  });
  page.drawText("Programme Desk · Digital seal", {
    x: sigX,
    y: verifyTop - 76,
    size: 7,
    font: fonts.regular,
    color: faint
  });

  y = verifyTop - qrSize - 18;
  const disclaimer = wrapText(
    "This is a computer-generated tax invoice. No physical signature is required. Retain for academic and finance records.",
    CONTENT_W,
    fonts.italic,
    7
  );
  for (const line of disclaimer) {
    page.drawText(line, { x: M, y, size: 7, font: fonts.italic, color: faint });
    y -= 9;
  }

  drawFooter(page, fonts, pageIndex, docId, generatedAt);
  return doc.save();
}
