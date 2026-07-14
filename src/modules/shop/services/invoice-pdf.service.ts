import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SITE_CONTACT } from "@/lib/site-contact";

export type InvoicePdfInput = {
  invoiceNumber: string;
  issuedAt: Date;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  shippingAddress: {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  lines: Array<{ description: string; qty: number; amountCents: number }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  gstin?: string;
  cgstCents?: number;
  sgstCents?: number;
  placeOfSupply?: string;
};

function inr(cents: number) {
  return `INR ${(cents / 100).toFixed(2)}`;
}

/** Builds a downloadable GST tax invoice PDF (binary). */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const ink = rgb(0.1, 0.1, 0.12);
  const mute = rgb(0.4, 0.4, 0.45);
  let y = height - 48;

  const write = (text: string, x: number, size: number, f = font, color = ink) => {
    page.drawText(text, { x, y, size, font: f, color });
  };

  write("CASHMIR BIOTECH", 48, 16, bold);
  write("Tax Invoice", 48, 11, font, mute);
  y -= 18;
  write(`GSTIN: ${input.gstin || process.env.COMPANY_GSTIN || "—"}`, 48, 9, font, mute);
  write(input.invoiceNumber, 360, 11, bold);
  write(`Issued ${input.issuedAt.toLocaleDateString("en-IN")}`, 360, 9, font, mute);
  y -= 14;
  write(`Order ${input.orderNumber}`, 360, 9, font, mute);

  y -= 28;
  write("Bill to", 48, 9, bold, mute);
  write("From", 320, 9, bold, mute);
  y -= 14;
  const billName = input.shippingAddress.fullName || input.customerName || "Customer";
  write(billName.slice(0, 48), 48, 10, bold);
  write("Cashmir Biotech", 320, 10, bold);
  y -= 12;
  const addr = [
    input.shippingAddress.line1,
    input.shippingAddress.line2,
    [input.shippingAddress.city, input.shippingAddress.state, input.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", ")
  ]
    .filter(Boolean)
    .join(", ");
  write((addr || "—").slice(0, 56), 48, 8, font, mute);
  write(SITE_CONTACT.location.slice(0, 40), 320, 8, font, mute);
  y -= 12;
  if (input.customerEmail) write(input.customerEmail.slice(0, 56), 48, 8, font, mute);
  write(SITE_CONTACT.primaryEmail.slice(0, 40), 320, 8, font, mute);
  if (input.placeOfSupply) {
    y -= 12;
    write(`Place of supply: ${input.placeOfSupply}`, 48, 8, font, mute);
  }

  y -= 28;
  write("Item", 48, 9, bold, mute);
  write("Qty", 360, 9, bold, mute);
  write("Amount", 430, 9, bold, mute);
  y -= 6;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.82) });
  y -= 16;

  for (const line of input.lines) {
    if (y < 120) break;
    write(line.description.slice(0, 48), 48, 9);
    write(String(line.qty), 360, 9);
    write(inr(line.amountCents), 430, 9);
    y -= 14;
  }

  y -= 10;
  page.drawLine({ start: { x: 320, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.82) });
  y -= 16;
  write("Subtotal", 360, 9, font, mute);
  write(inr(input.subtotalCents), 430, 9);
  y -= 14;
  if (typeof input.cgstCents === "number" && typeof input.sgstCents === "number") {
    write("CGST", 360, 9, font, mute);
    write(inr(input.cgstCents), 430, 9);
    y -= 14;
    write("SGST", 360, 9, font, mute);
    write(inr(input.sgstCents), 430, 9);
    y -= 14;
  } else {
    write("Tax", 360, 9, font, mute);
    write(inr(input.taxCents), 430, 9);
    y -= 14;
  }
  write("Total", 360, 11, bold);
  write(inr(input.totalCents), 430, 11, bold);

  y = 64;
  write("This document is a computer-generated tax invoice for Cashmir Biotech.", 48, 7, font, mute);
  write("Retain for your records. For CoA / lot certificates use the Customer Portal.", 48, 7, font, mute);

  return doc.save();
}
