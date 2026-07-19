/**
 * Single source of truth for storefront/admin price display and stock badges.
 * Discount % is always derived — never stored.
 */

export function paiseFromInr(inr: number): number {
  return Math.round(Math.max(0, inr) * 100);
}

export function sellingInrFromPaise(pricePaise: number | null | undefined, mrpInr: number): number {
  if (typeof pricePaise === "number" && pricePaise > 0) {
    return Math.round(pricePaise / 100);
  }
  return Math.max(0, mrpInr);
}

/** Effective charge in paise — zero pricePaise falls back to MRP (legacy rows). */
export function effectiveSellingPaise(pricePaise: number | null | undefined, mrpInr: number): number {
  if (typeof pricePaise === "number" && pricePaise > 0) return pricePaise;
  return Math.max(0, mrpInr) * 100;
}

export function getPricingDisplay(mrpInr: number, sellingInr: number) {
  const mrp = Math.max(0, Math.round(mrpInr));
  const selling = Math.max(0, Math.round(sellingInr));
  const hasDiscount = selling > 0 && mrp > 0 && selling < mrp;
  const discountPercent = hasDiscount ? Math.round(((mrp - selling) / mrp) * 100) : 0;

  return {
    mrpInr: mrp,
    sellingInr: selling,
    hasDiscount,
    discountPercent,
    showStruckMrp: hasDiscount,
    showBadge: hasDiscount && discountPercent > 0
  };
}

export function getStockStatus(stockQty: number, lowStockThreshold = 5) {
  if (stockQty <= 0) return "out_of_stock" as const;
  if (stockQty <= lowStockThreshold) return "low_stock" as const;
  return "in_stock" as const;
}

export type StockStatus = ReturnType<typeof getStockStatus>;
