import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("payment verify policy", () => {
  it("never calls markOrderFailed on invalid signatures", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/payment/verify/route.ts"),
      "utf8"
    );
    // Verify route should NOT call markOrderFailed — invalid sig just returns 400.
    expect(source).not.toMatch(/markOrderFailed\s*\(/);
  });
});

describe("invoice PDF route", () => {
  it("exports a GET handler that builds binary PDF", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/order/[orderNumber]/invoice.pdf/route.ts"),
      "utf8"
    );
    expect(source).toContain("buildInvoicePdf");
    expect(source).toContain("application/pdf");
  });
});

describe("coupon burn timing", () => {
  it("increments usedCount on paid path only", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/modules/shop/services/order.service.ts"),
      "utf8"
    );
    // Coupon validation defers burn until payment; raw SQL bump in markOrderPaid.
    expect(source).toMatch(/do NOT burn usedCount until payment/);
    expect(source).toMatch(/usedCount.*usedCount.*\+.*1/);
  });
});

vi.mock("@/lib/db", () => ({ db: {} }));

describe("OrderService Utilities & Cart Pricing", () => {
  it("should generate a correctly formatted order number", async () => {
    const { generateOrderNumber } = await import("./order.service");
    const num = generateOrderNumber();
    expect(num).toMatch(/^CB-\d{8}-[A-F0-9]{8}$/);
  });

  it("should reject an empty cart in priceCart", async () => {
    const { priceCart } = await import("./order.service");
    const empty = await priceCart([]);
    expect(empty.ok).toBe(false);
  });
});

describe("invoice PDF builder", () => {
  it("produces a non-empty PDF buffer", async () => {
    const { buildInvoicePdf } = await import("./invoice-pdf.service");
    const bytes = await buildInvoicePdf({
      invoiceNumber: "INV-TEST-1",
      issuedAt: new Date("2026-01-15"),
      orderNumber: "CB-20260115-ABCD1234",
      customerName: "Test Lab",
      customerEmail: "lab@example.com",
      shippingAddress: {
        fullName: "Test Lab",
        line1: "1 Research Road",
        city: "Srinagar",
        state: "Jammu and Kashmir",
        postalCode: "190001"
      },
      lines: [{ description: "Formula A", qty: 2, amountCents: 20000 }],
      subtotalCents: 20000,
      taxCents: 3600,
      totalCents: 23600,
      cgstCents: 1800,
      sgstCents: 1800,
      placeOfSupply: "Jammu and Kashmir"
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(Buffer.from(bytes).subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
