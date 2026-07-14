import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { buildInvoicePdf, type InvoicePdfInput } from "@/modules/shop/services/invoice-pdf.service";

/** Persist invoice PDF to Blob (prod) or local public/invoices (dev) and return public URL. */
export async function persistInvoicePdfFile(
  invoiceId: string,
  invoiceNumber: string,
  input: InvoicePdfInput
): Promise<string | null> {
  try {
    const bytes = await buildInvoicePdf(input);
    const fileName = `${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    let url: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`invoices/${fileName}`, Buffer.from(bytes), {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true
      });
      url = blob.url;
    } else {
      const dir = path.join(process.cwd(), "public", "invoices");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, fileName), Buffer.from(bytes));
      url = `/invoices/${fileName}`;
    }

    await db.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: url } });
    return url;
  } catch (err) {
    logger.warn({ err, invoiceId, event: "invoice_pdf_persist_failed" }, "could not persist invoice PDF");
    return null;
  }
}
