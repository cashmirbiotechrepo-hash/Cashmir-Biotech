import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { buildInvoicePdf } from "./invoice-pdf.service";
import { buildPackingSlipPdf } from "./packing-pdf.service";

describe("branded document PDFs", () => {
  it("builds a GST invoice with hierarchy and payment block", async () => {
    const bytes = await buildInvoicePdf({
      invoiceNumber: "CB-2026-0001",
      issuedAt: new Date("2026-07-15"),
      orderNumber: "CB-20260715-C0671C6E",
      customerName: "Moalim Javeed",
      customerEmail: "lab@example.com",
      customerPhone: "9103524624",
      shippingAddress: {
        fullName: "Moalim Javeed",
        line1: "Dal Lake Road",
        city: "Srinagar",
        state: "Jammu and Kashmir",
        postalCode: "190001",
        phone: "9103524624"
      },
      lines: [
        {
          description: "Cashmir Isabgol Psyllium Husk",
          qty: 1,
          amountCents: 42000,
          unitPriceCents: 42000,
          sku: "ISB-100",
          lot: "LOT-JUL26"
        }
      ],
      subtotalCents: 42000,
      taxCents: 0,
      shippingCents: 6000,
      discountCents: 0,
      totalCents: 48000,
      cgstCents: 0,
      sgstCents: 0,
      placeOfSupply: "Jammu and Kashmir",
      paymentStatus: "paid",
      paymentMethod: "Razorpay",
      razorpayPaymentId: "pay_test_123",
      paidAt: new Date("2026-07-15T10:00:00Z"),
      confirmationToken: "demo-token"
    });

    expect(bytes.byteLength).toBeGreaterThan(4000);
    expect(Buffer.from(bytes).subarray(0, 4).toString("ascii")).toBe("%PDF");

    const outDir = path.join(process.cwd(), ".tmp");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "invoice-preview.pdf"), bytes);
  });

  it("builds a packing slip with barcode and checklist", async () => {
    const bytes = await buildPackingSlipPdf({
      orderNumber: "CB-20260715-C0671C6E",
      createdAt: new Date("2026-07-15"),
      batchLabel: "JUL-2026-BATCH",
      customerName: "Moalim Javeed",
      customerEmail: "lab@example.com",
      shippingAddress: {
        fullName: "Moalim Javeed",
        line1: "Dal Lake Road",
        city: "Srinagar",
        state: "Jammu and Kashmir",
        postalCode: "190001",
        phone: "9103524624"
      },
      items: [
        {
          productName: "Cashmir Isabgol Psyllium Husk",
          quantity: 2,
          sku: "ISB-100",
          lotCodes: "LOT-JUL26",
          sizeLabel: "100 g"
        }
      ],
      carrier: "Delhivery",
      trackingNumber: "DLV123",
      confirmationToken: "demo-token"
    });

    expect(bytes.byteLength).toBeGreaterThan(4000);
    expect(Buffer.from(bytes).subarray(0, 4).toString("ascii")).toBe("%PDF");

    const outDir = path.join(process.cwd(), ".tmp");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "packing-preview.pdf"), bytes);
  });
});
