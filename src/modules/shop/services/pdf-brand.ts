import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import type { PDFDocument, PDFImage, PDFPage, RGB } from "pdf-lib";
import { rgb } from "pdf-lib";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { SITE_CONTACT } from "@/lib/site-contact";

export const PDF = {
  page: { w: 595.28 as number, h: 841.89 as number },
  margin: 40,
  ink: rgb(0.067, 0.067, 0.071),
  paper: rgb(1, 1, 1),
  pearl: rgb(0.965, 0.96, 0.945),
  line: rgb(0.86, 0.85, 0.83),
  mute: rgb(0.42, 0.41, 0.39),
  gold: rgb(0.72, 0.58, 0.35),
  white: rgb(1, 1, 1),
  success: rgb(0.12, 0.45, 0.28),
  successBg: rgb(0.9, 0.96, 0.92),
  warn: rgb(0.55, 0.35, 0.05),
  warnBg: rgb(0.98, 0.94, 0.86)
} as const;

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.cashmirbiotech.com").replace(/\/$/, "");
}

export function formatInrPdf(cents: number) {
  const n = (cents / 100).toFixed(2);
  const [rupees, paise] = n.split(".");
  const withCommas = Number(rupees).toLocaleString("en-IN");
  return `Rs. ${withCommas}.${paise}`;
}

export function sanitizePdfFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGB,
  border?: { color: RGB; thickness?: number }
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color,
    ...(border
      ? { borderColor: border.color, borderWidth: border.thickness ?? 0.75 }
      : {})
  });
}

export async function embedBrandLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "logo.png"));
    return await doc.embedPng(bytes);
  } catch {
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", "web-app-manifest-192x192.png"));
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

export async function embedQrPng(doc: PDFDocument, value: string, size = 110): Promise<PDFImage | null> {
  try {
    const buf = await QRCode.toBuffer(value, {
      type: "png",
      width: size * 2,
      margin: 1,
      color: { dark: "#111111", light: "#FFFFFF" },
      errorCorrectionLevel: "M"
    });
    return await doc.embedPng(buf);
  } catch {
    return null;
  }
}

export async function embedBarcodePng(doc: PDFDocument, text: string): Promise<PDFImage | null> {
  try {
    const buf = await bwipjs.toBuffer({
      bcid: "code128",
      text,
      scale: 2,
      height: 12,
      includetext: true,
      textsize: 9,
      textxalign: "center",
      backgroundcolor: "FFFFFF",
      paddingwidth: 6,
      paddingheight: 4
    });
    return await doc.embedPng(buf);
  } catch {
    return null;
  }
}

export function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, size: number) => number },
  size: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

export const BRAND_TRUST = [
  "Patent-backed formulation",
  "Batch traceable - laboratory verified",
  "Research partner - SKUAST-K",
  "GMP-aligned manufacturing"
] as const;

export function companyBlock() {
  const gstin = process.env.COMPANY_GSTIN?.trim();
  return {
    name: SITE_CONTACT.company,
    location: SITE_CONTACT.location,
    email: SITE_CONTACT.primaryEmail,
    support: SITE_CONTACT.supportEmail,
    phone: SITE_CONTACT.phone,
    gstin: gstin && gstin.length > 0 ? gstin : null,
    demoMode: !gstin || gstin.length < 5
  };
}
