import { describe, expect, it } from "vitest";
import {
  effectiveSellingPaise,
  getPricingDisplay,
  getStockStatus,
  sellingInrFromPaise
} from "@/lib/pricing";

describe("pricing helpers", () => {
  it("computes discount and shows badge when selling < mrp", () => {
    const d = getPricingDisplay(600, 340);
    expect(d.hasDiscount).toBe(true);
    expect(d.discountPercent).toBe(43);
    expect(d.showBadge).toBe(true);
    expect(d.showStruckMrp).toBe(true);
  });

  it("hides badge when selling equals mrp", () => {
    const d = getPricingDisplay(500, 500);
    expect(d.hasDiscount).toBe(false);
    expect(d.showBadge).toBe(false);
    expect(d.showStruckMrp).toBe(false);
  });

  it("falls back from zero pricePaise to mrp", () => {
    expect(effectiveSellingPaise(0, 350)).toBe(35000);
    expect(sellingInrFromPaise(null, 350)).toBe(350);
    expect(sellingInrFromPaise(29900, 350)).toBe(299);
  });

  it("classifies stock status", () => {
    expect(getStockStatus(0)).toBe("out_of_stock");
    expect(getStockStatus(3, 5)).toBe("low_stock");
    expect(getStockStatus(20, 5)).toBe("in_stock");
  });
});
