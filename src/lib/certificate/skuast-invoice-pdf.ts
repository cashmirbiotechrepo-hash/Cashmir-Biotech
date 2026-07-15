import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawRect,
  embedBarcodePng,
  embedQrPng,
  formatInrPdf,
  wrapText
} from "@/modules/shop/services/pdf-brand";
import { CERTIFICATE_ISSUER } from "@/lib/certificate/courses";
import type { CourseLineSnapshot } from "@/lib/certificate/enrollment";

const A4 = { w: 595.28, h: 841.89 };
const M = 36;

const ink = rgb(0.07, 0.12, 0.16);
const pine = rgb(0.06, 0.22, 0.18);
const sapphire = rgb(0.1, 0.28, 0.48);
const rule = rgb(0.78, 0.8, 0.82);
const mute = rgb(0.38, 0.42, 0.45);
const paper = rgb(0.99, 0.99, 0.985);
const band = rgb(0.94, 0.96, 0.95);
const gold = rgb(0.62, 0.5, 0.28);
const paidFg = rgb(0.08, 0.4, 0.26);
const paidBg = rgb(0.88, 0.95, 0.9);

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

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

/** Premium A4 tax invoice under SKUAST-K Continuing Education Cell letterhead. */
export async function buildSkuastCertificateInvoicePdf(input: SkuastInvoiceInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let y = A4.h;

  // Outer institutional frame
  page.drawRectangle({
    x: 18,
    y: 18,
    width: A4.w - 36,
    height: A4.h - 36,
    borderColor: pine,
    borderWidth: 1.25
  });
  page.drawRectangle({
    x: 22,
    y: 22,
    width: A4.w - 44,
    height: A4.h - 44,
    borderColor: gold,
    borderWidth: 0.6
  });

  // Header band
  const headerH = 92;
  drawRect(page, M, A4.h - M - headerH, A4.w - M * 2, headerH, pine);
  y = A4.h - M - 16;
  page.drawText(CERTIFICATE_ISSUER.shortName, {
    x: M + 14,
    y,
    size: 18,
    font: bold,
    color: paper
  });
  y -= 16;
  page.drawText(CERTIFICATE_ISSUER.legalName, {
    x: M + 14,
    y,
    size: 8,
    font: font,
    color: rgb(0.85, 0.92, 0.88),
    maxWidth: 340
  });
  y -= 12;
  page.drawText(CERTIFICATE_ISSUER.unit, {
    x: M + 14,
    y,
    size: 8.5,
    font: bold,
    color: gold
  });
  y -= 12;
  page.drawText(
    `${CERTIFICATE_ISSUER.campus}, ${CERTIFICATE_ISSUER.city} ${CERTIFICATE_ISSUER.pincode} · ${CERTIFICATE_ISSUER.state}`,
    { x: M + 14, y, size: 7.5, font, color: rgb(0.78, 0.86, 0.82) }
  );
  y -= 11;
  page.drawText(`${CERTIFICATE_ISSUER.email} · ${CERTIFICATE_ISSUER.phone}`, {
    x: M + 14,
    y,
    size: 7.5,
    font,
    color: rgb(0.78, 0.86, 0.82)
  });

  // Document title plate
  page.drawText("TAX INVOICE", {
    x: A4.w - M - 118,
    y: A4.h - M - 28,
    size: 12,
    font: bold,
    color: paper
  });
  page.drawText("(Original for Recipient)", {
    x: A4.w - M - 118,
    y: A4.h - M - 42,
    size: 7,
    font: italic,
    color: rgb(0.8, 0.88, 0.84)
  });
  drawRect(page, A4.w - M - 118, A4.h - M - 72, 104, 22, paidBg);
  page.drawText("PAYMENT RECEIVED", {
    x: A4.w - M - 110,
    y: A4.h - M - 65,
    size: 7.5,
    font: bold,
    color: paidFg
  });

  y = A4.h - M - headerH - 18;

  // Meta grid
  const metaY = y;
  drawRect(page, M, metaY - 54, A4.w - M * 2, 58, band);
  page.drawText("Invoice No.", { x: M + 10, y: metaY - 14, size: 7, font, color: mute });
  page.drawText(input.invoiceNumber, { x: M + 10, y: metaY - 28, size: 9, font: bold, color: ink });
  page.drawText("Enrollment No.", { x: M + 200, y: metaY - 14, size: 7, font, color: mute });
  page.drawText(input.enrollmentNumber, { x: M + 200, y: metaY - 28, size: 9, font: bold, color: ink });
  page.drawText("Invoice Date", { x: M + 10, y: metaY - 42, size: 7, font, color: mute });
  page.drawText(fmtDate(input.issuedAt), { x: M + 70, y: metaY - 42, size: 8, font: bold, color: ink });
  page.drawText("Paid On", { x: M + 200, y: metaY - 42, size: 7, font, color: mute });
  page.drawText(fmtDate(input.paidAt ?? input.issuedAt), {
    x: M + 240,
    y: metaY - 42,
    size: 8,
    font: bold,
    color: ink
  });
  page.drawText("Programme", { x: M + 360, y: metaY - 14, size: 7, font, color: mute });
  page.drawText(CERTIFICATE_ISSUER.programmeCode, {
    x: M + 360,
    y: metaY - 28,
    size: 7.5,
    font: bold,
    color: sapphire,
    maxWidth: 160
  });
  page.drawText("Place of Supply", { x: M + 360, y: metaY - 42, size: 7, font, color: mute });
  page.drawText(input.placeOfSupply, { x: M + 430, y: metaY - 42, size: 7.5, font: bold, color: ink });

  y = metaY - 72;

  // Bill to / Issuer
  page.drawText("BILL TO (PARTICIPANT)", { x: M, y, size: 7.5, font: bold, color: sapphire });
  page.drawText("ISSUED BY", { x: A4.w / 2 + 8, y, size: 7.5, font: bold, color: sapphire });
  y -= 14;
  page.drawText(input.studentName, { x: M, y, size: 11, font: bold, color: ink });
  page.drawText(CERTIFICATE_ISSUER.shortName, { x: A4.w / 2 + 8, y, size: 10, font: bold, color: pine });
  y -= 13;
  page.drawText(input.studentEmail, { x: M, y, size: 8, font, color: mute });
  page.drawText(CERTIFICATE_ISSUER.unit, {
    x: A4.w / 2 + 8,
    y,
    size: 7.5,
    font,
    color: mute,
    maxWidth: 240
  });
  y -= 12;
  if (input.studentPhone) {
    page.drawText(`Phone: ${input.studentPhone}`, { x: M, y, size: 8, font, color: mute });
  }
  page.drawText(`${CERTIFICATE_ISSUER.campus}, ${CERTIFICATE_ISSUER.city}`, {
    x: A4.w / 2 + 8,
    y,
    size: 7.5,
    font,
    color: mute
  });
  y -= 12;
  if (input.institution) {
    page.drawText(`Institution: ${input.institution}`, { x: M, y, size: 8, font, color: mute, maxWidth: 250 });
  }
  page.drawText(CERTIFICATE_ISSUER.gstNote, {
    x: A4.w / 2 + 8,
    y,
    size: 6.5,
    font: italic,
    color: mute,
    maxWidth: 240
  });

  y -= 22;
  page.drawText("COMPUTATIONAL BIOLOGY SHORT COURSES — FEE RECEIPT", {
    x: M,
    y,
    size: 8,
    font: bold,
    color: pine
  });
  y -= 8;
  page.drawLine({
    start: { x: M, y },
    end: { x: A4.w - M, y },
    thickness: 0.75,
    color: rule
  });

  // Table header
  y -= 18;
  const cols = { code: M, title: M + 58, cr: A4.w - M - 200, tax: A4.w - M - 130, amt: A4.w - M - 70 };
  drawRect(page, M, y - 4, A4.w - M * 2, 18, pine);
  page.drawText("Code", { x: cols.code + 4, y: y + 2, size: 7.5, font: bold, color: paper });
  page.drawText("Course title (1 credit each)", { x: cols.title, y: y + 2, size: 7.5, font: bold, color: paper });
  page.drawText("Cr.", { x: cols.cr, y: y + 2, size: 7.5, font: bold, color: paper });
  page.drawText("Taxable", { x: cols.tax, y: y + 2, size: 7.5, font: bold, color: paper });
  page.drawText("Amount", { x: cols.amt, y: y + 2, size: 7.5, font: bold, color: paper });
  y -= 16;

  for (const line of input.lines) {
    if (y < 160) break;
    page.drawText(line.code, { x: cols.code + 4, y, size: 7.5, font: bold, color: sapphire });
    const titleLines = wrapText(line.title, 250, font, 8);
    page.drawText(titleLines[0] ?? line.title, { x: cols.title, y, size: 8, font, color: ink });
    page.drawText(String(line.credits), { x: cols.cr + 4, y, size: 8, font, color: ink });
    page.drawText(formatInrPdf(line.taxableCents), { x: cols.tax, y, size: 7.5, font, color: mute });
    page.drawText(formatInrPdf(line.feeInclusiveCents), { x: cols.amt, y, size: 8, font: bold, color: ink });
    y -= 14;
    if (titleLines.length > 1) {
      page.drawText(titleLines[1]!, { x: cols.title, y: y + 2, size: 7, font, color: mute });
      y -= 10;
    }
    page.drawLine({
      start: { x: M, y: y + 8 },
      end: { x: A4.w - M, y: y + 8 },
      thickness: 0.35,
      color: rule
    });
  }

  y -= 6;
  page.drawText(`SAC / HSN ${CERTIFICATE_ISSUER.sacHsn} · Fees are inclusive of GST @ 18%`, {
    x: M,
    y,
    size: 7,
    font: italic,
    color: mute
  });

  // Totals panel
  const boxW = 220;
  const boxX = A4.w - M - boxW;
  y -= 16;
  const totalsTop = y;
  drawRect(page, boxX, totalsTop - 88, boxW, 92, band);
  const row = (label: string, value: string, yy: number, strong = false) => {
    page.drawText(label, { x: boxX + 10, y: yy, size: 8, font: strong ? bold : font, color: strong ? ink : mute });
    const vw = bold.widthOfTextAtSize(value, strong ? 10 : 8);
    page.drawText(value, {
      x: boxX + boxW - 10 - vw,
      y: yy,
      size: strong ? 10 : 8,
      font: strong ? bold : font,
      color: ink
    });
  };
  row("Taxable value", formatInrPdf(input.subtotalCents), totalsTop - 14);
  row("CGST @ 9%", formatInrPdf(input.cgstCents), totalsTop - 30);
  row("SGST @ 9%", formatInrPdf(input.sgstCents), totalsTop - 46);
  page.drawLine({
    start: { x: boxX + 10, y: totalsTop - 54 },
    end: { x: boxX + boxW - 10, y: totalsTop - 54 },
    thickness: 0.6,
    color: rule
  });
  row("Grand total (incl. GST)", formatInrPdf(input.totalCents), totalsTop - 72, true);

  y = totalsTop - 14;
  page.drawText("Amount in words", { x: M, y, size: 7, font, color: mute });
  y -= 12;
  const words = wrapText(amountWordsInr(input.totalCents), 280, bold, 8);
  for (const w of words) {
    page.drawText(w, { x: M, y, size: 8, font: bold, color: ink });
    y -= 11;
  }

  y -= 8;
  page.drawText(`Total academic credits awarded: ${input.credits}`, {
    x: M,
    y,
    size: 8.5,
    font: bold,
    color: pine
  });

  y -= 18;
  page.drawText("Payment reference", { x: M, y, size: 7, font, color: mute });
  y -= 11;
  page.drawText(`Razorpay Order: ${input.razorpayOrderId || "—"}`, { x: M, y, size: 7.5, font, color: ink });
  y -= 10;
  page.drawText(`Razorpay Payment: ${input.razorpayPaymentId || "—"}`, { x: M, y, size: 7.5, font, color: ink });
  y -= 10;
  page.drawText(
    `Settlement note: ${
      input.paymentOutcome === "gateway_success"
        ? "Collected via payment gateway."
        : "Enrolment fee receipt issued under programme desk authority."
    }`,
    { x: M, y, size: 7, font: italic, color: mute, maxWidth: 320 }
  );

  // QR + seal
  const qr = await embedQrPng(doc, input.verifyUrl, 96);
  if (qr) {
    page.drawImage(qr, { x: A4.w - M - 86, y: 88, width: 72, height: 72 });
    page.drawText("Scan to verify", {
      x: A4.w - M - 82,
      y: 78,
      size: 6.5,
      font,
      color: mute
    });
  }

  const barcode = await embedBarcodePng(doc, input.invoiceNumber.replace(/\//g, "-").slice(0, 28));
  if (barcode) {
    page.drawImage(barcode, { x: M, y: 62, width: 160, height: 36 });
  }

  page.drawText("For SKUAST-K Continuing Education Cell", {
    x: A4.w / 2 - 40,
    y: 118,
    size: 7,
    font,
    color: mute
  });
  page.drawText("Authorised Signatory", {
    x: A4.w / 2 - 20,
    y: 88,
    size: 8,
    font: bold,
    color: ink
  });
  page.drawLine({
    start: { x: A4.w / 2 - 50, y: 100 },
    end: { x: A4.w / 2 + 70, y: 100 },
    thickness: 0.6,
    color: rule
  });

  page.drawText(
    "This is a computer-generated tax invoice for the Computational Biology short-course programme. Retain for academic and finance records.",
    {
      x: M,
      y: 42,
      size: 6.5,
      font: italic,
      color: mute,
      maxWidth: A4.w - M * 2 - 100
    }
  );
  page.drawText(CERTIFICATE_ISSUER.website, {
    x: M,
    y: 30,
    size: 6.5,
    font,
    color: sapphire
  });

  return doc.save();
}
