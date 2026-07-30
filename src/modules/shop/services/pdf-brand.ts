import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import { rgb } from "pdf-lib";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { SITE_CONTACT } from "@/lib/site-contact";
import { companyLegal, companyLegalConfigured } from "@/lib/company-legal";

/** A4 @ 72pt — Swiss/print-first document system.
 * One typeface: Helvetica (pdf-lib StandardFonts). HTML print uses Inter via site font-sans.
 * No monospace / serif / italic decorative faces.
 */
export const PDF = {
  page: { w: 595.28 as number, h: 841.89 as number },
  /** ~17 mm */
  margin: 48,
  ink: rgb(0.08, 0.08, 0.09),
  mute: rgb(0.38, 0.38, 0.4),
  faint: rgb(0.55, 0.55, 0.57),
  line: rgb(0.82, 0.82, 0.83),
  paper: rgb(1, 1, 1),
  /** Restrained status green — text only, never pills */
  success: rgb(0.12, 0.38, 0.26),
  warn: rgb(0.45, 0.28, 0.08),
  /** Brand accent — logo / rare detail only */
  accent: rgb(0.72, 0.28, 0.12),
  white: rgb(1, 1, 1),
  /** Legacy aliases used by older call sites */
  pearl: rgb(0.97, 0.97, 0.97),
  gold: rgb(0.72, 0.28, 0.12),
  successBg: rgb(0.94, 0.97, 0.95),
  warnBg: rgb(0.98, 0.96, 0.92)
} as const;

export const DOC = {
  brand: 17,
  title: 9,
  number: 15,
  label: 8,
  body: 10,
  value: 10.5,
  tableHead: 8,
  total: 17,
  footer: 8,
  tracking: 0.6
} as const;

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.cashmirbiotech.com").replace(/\/$/, "");
}

/** Helvetica-safe currency (₹ requires embedded Unicode font + fontkit). */
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

export function drawHairline(
  page: PDFPage,
  x1: number,
  y: number,
  x2: number,
  thickness = 0.6,
  color: RGB = PDF.line
) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color
  });
}

/** Print-safe mark circle (~3 mm) for QC / pick marks. */
export function drawMarkCircle(page: PDFPage, cx: number, cy: number, diameterPt = 8.5) {
  const r = diameterPt / 2;
  page.drawCircle({
    x: cx,
    y: cy,
    size: r,
    borderColor: PDF.ink,
    borderWidth: 0.7
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
      color: { dark: "#141416", light: "#FFFFFF" },
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
      height: 10,
      includetext: false,
      backgroundcolor: "FFFFFF",
      paddingwidth: 4,
      paddingheight: 2
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

export function companyBlock() {
  const legal = companyLegal();
  return {
    name: SITE_CONTACT.company,
    location: SITE_CONTACT.location,
    addressLines: [...SITE_CONTACT.addressLines],
    email: SITE_CONTACT.primaryEmail,
    support: SITE_CONTACT.supportEmail,
    phone: SITE_CONTACT.phone,
    gstin: legal.gstin,
    pan: legal.pan,
    cin: legal.cin,
    demoMode: !companyLegalConfigured()
  };
}

export type DocHeaderInput = {
  page: PDFPage;
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  title: string;
  number: string;
  metaLines: string[];
};

/**
 * Shared header: logo + wordmark left, document identity right, one hairline.
 * Returns y position below the rule (content start).
 */
export async function drawDocHeader(input: DocHeaderInput): Promise<number> {
  const { page, doc, font, bold, title, number, metaLines } = input;
  const m = PDF.margin;
  const top = PDF.page.h - m;
  const logo = await embedBrandLogo(doc);

  let brandX = m;
  if (logo) {
    const logoH = 28;
    const logoW = Math.min((logo.width / logo.height) * logoH, 72);
    page.drawImage(logo, {
      x: m,
      y: top - logoH,
      width: logoW,
      height: logoH
    });
    brandX = m + logoW + 10;
  }

  // Vertically center wordmark against logo when present
  const brandY = logo ? top - 18 : top - 14;
  page.drawText("Cashmir Biotech", {
    x: brandX,
    y: brandY,
    size: DOC.brand,
    font: bold,
    color: PDF.ink
  });

  const rightEdge = PDF.page.w - m;
  const titleW = bold.widthOfTextAtSize(title, DOC.title);
  page.drawText(title, {
    x: rightEdge - titleW,
    y: top - 10,
    size: DOC.title,
    font: bold,
    color: PDF.ink
  });

  let ry = top - 28;
  page.drawText(number, {
    x: rightEdge - bold.widthOfTextAtSize(number, DOC.number),
    y: ry,
    size: DOC.number,
    font: bold,
    color: PDF.ink
  });
  ry -= 15;
  for (const line of metaLines) {
    const w = font.widthOfTextAtSize(line, DOC.label);
    page.drawText(line, {
      x: rightEdge - w,
      y: ry,
      size: DOC.label,
      font,
      color: PDF.mute
    });
    ry -= 11;
  }

  const ruleY = Math.min(top - 56, ry - 6);
  drawHairline(page, m, ruleY, PDF.page.w - m, 0.7, PDF.ink);
  return ruleY - 22;
}

export type DocFooterInput = {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  docLabel: string;
  pageLabel?: string;
};

/** Shared footer: company address left, document id right. */
export function drawDocFooter(input: DocFooterInput) {
  const { page, font, bold, docLabel, pageLabel = "Page 1 of 1" } = input;
  const m = PDF.margin;
  const company = companyBlock();
  const footerTop = 72;

  drawHairline(page, m, footerTop + 28, PDF.page.w - m, 0.6, PDF.line);

  let y = footerTop + 14;
  page.drawText(company.name, { x: m, y, size: DOC.footer, font: bold, color: PDF.ink });
  y -= 10;
  for (const line of company.addressLines) {
    page.drawText(line, { x: m, y, size: DOC.footer - 0.5, font, color: PDF.mute });
    y -= 9;
  }
  page.drawText(`GSTIN ${company.gstin}  ·  PAN ${company.pan}  ·  CIN ${company.cin}`, {
    x: m,
    y,
    size: DOC.footer - 1,
    font,
    color: PDF.faint
  });

  const right = PDF.page.w - m;
  page.drawText(docLabel, {
    x: right - font.widthOfTextAtSize(docLabel, DOC.footer),
    y: footerTop + 14,
    size: DOC.footer,
    font,
    color: PDF.mute
  });
  page.drawText(pageLabel, {
    x: right - font.widthOfTextAtSize(pageLabel, DOC.footer),
    y: footerTop + 3,
    size: DOC.footer,
    font,
    color: PDF.faint
  });
}

/** @deprecated Prefer document notes without cards */
export const BRAND_TRUST = [
  "Patent-backed formulation",
  "Batch traceable - laboratory verified",
  "Research partner - SKUAST-K",
  "GMP-aligned manufacturing"
] as const;
