import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Money } from "@/lib/money";

export type ShippingRates = {
  flatShippingInr: number;
  freeShippingThresholdInr: number;
  freeThresholdCents: number;
  flatShippingCents: number;
};

function clampInr(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function envShippingFallback(): ShippingRates {
  const freeShippingThresholdInr = clampInr(
    parseInt(process.env.FREE_SHIPPING_THRESHOLD_INR || "999", 10),
    999
  );
  const flatShippingInr = clampInr(parseInt(process.env.FLAT_SHIPPING_INR || "60", 10), 60);
  return {
    flatShippingInr,
    freeShippingThresholdInr,
    freeThresholdCents: freeShippingThresholdInr * 100,
    flatShippingCents: flatShippingInr * 100
  };
}

/**
 * Store-wide delivery defaults from SiteSettings (admin), with env fallback.
 * Used by cart pricing, checkout UI, and product copy.
 * Cached briefly so cart/checkout traffic does not hammer SiteSettings on every price.
 */
let cachedShippingRates: ShippingRates | null = null;
let shippingRatesCacheExpiresAt = 0;
const SHIPPING_RATES_TTL_MS = 60_000;

export async function getShippingRates(): Promise<ShippingRates> {
  if (cachedShippingRates && Date.now() < shippingRatesCacheExpiresAt) {
    return cachedShippingRates;
  }

  try {
    const settings = await db.siteSettings.findUnique({
      where: { id: 1 },
      select: { flatShippingInr: true, freeShippingThresholdInr: true }
    });
    if (settings) {
      const flatShippingInr = clampInr(settings.flatShippingInr, 60);
      const freeShippingThresholdInr = clampInr(settings.freeShippingThresholdInr, 999);
      const rates: ShippingRates = {
        flatShippingInr,
        freeShippingThresholdInr,
        freeThresholdCents: freeShippingThresholdInr * 100,
        flatShippingCents: flatShippingInr * 100
      };
      cachedShippingRates = rates;
      shippingRatesCacheExpiresAt = Date.now() + SHIPPING_RATES_TTL_MS;
      return rates;
    }
  } catch (error) {
    logger.warn({ err: error, event: "shipping_rates_fallback" }, "using env shipping defaults");
  }
  const fallback = envShippingFallback();
  cachedShippingRates = fallback;
  shippingRatesCacheExpiresAt = Date.now() + SHIPPING_RATES_TTL_MS;
  return fallback;
}

/** Drop the in-process shipping cache (e.g. after admin updates SiteSettings). */
export function invalidateShippingRatesCache() {
  cachedShippingRates = null;
  shippingRatesCacheExpiresAt = 0;
}

/** MRP prices are GST-inclusive, so tax is not added on top. */
const TAX = Money.fromCents(0);

export const MAX_QTY_PER_ITEM = 20;

export type CartInputItem = { productId: string; quantity: number };

export type PricedLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  couponCode?: string;
  discountCents?: number;
};

export type PriceResult = { ok: true; cart: PricedCart } | { ok: false; error: string };

/**
 * Re-validates a cart entirely from the DB: product existence, active flag, quantity bounds, price,
 * and optional coupon code validity (HIGH-11).
 * Uses the Money value object for all currency math to prevent floating-point/precision issues.
 */
export async function priceCart(items: CartInputItem[], couponCode?: string): Promise<PriceResult> {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (items.length > 20) {
    return { ok: false, error: "Too many distinct items in cart (maximum 20)." };
  }

  const clean = new Map<string, number>();
  let totalUnits = 0;
  for (const item of items) {
    if (!item?.productId || typeof item.productId !== "string" || typeof item.quantity !== "number" || !Number.isFinite(item.quantity)) continue;
    const qty = Math.floor(item.quantity);
    if (qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return { ok: false, error: `Quantity per item must be between 1 and ${MAX_QTY_PER_ITEM}.` };
    }
    const current = clean.get(item.productId) ?? 0;
    const combined = current + qty;
    if (combined > MAX_QTY_PER_ITEM) {
      return { ok: false, error: `Maximum ${MAX_QTY_PER_ITEM} units allowed per item.` };
    }
    clean.set(item.productId, combined);
    totalUnits += qty;
    if (totalUnits > 100) {
      return { ok: false, error: "Cart exceeds maximum total units limit (100)." };
    }
  }
  if (clean.size === 0) return { ok: false, error: "Your cart is empty." };

  const products = await db.product.findMany({
    where: { id: { in: [...clean.keys()] }, active: true }
  });

  const lines: PricedLine[] = [];
  let subtotal = Money.fromCents(0);

  for (const [productId, quantity] of clean) {
    const product = products.find((p) => p.id === productId);
    if (!product) return { ok: false, error: "One or more items are no longer available." };
    const unitPrice = Money.fromInr(product.mrpInr);
    const lineTotal = unitPrice.multiply(quantity);
    subtotal = subtotal.add(lineTotal);
    
    lines.push({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPriceCents: unitPrice.cents,
      lineTotalCents: lineTotal.cents
    });
  }

  let discount = Money.fromCents(0);
  let normalizedCoupon: string | undefined;

  if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
    normalizedCoupon = couponCode.trim().toUpperCase();
    const coupon = await db.coupon.findUnique({ where: { code: normalizedCoupon } });
    if (!coupon || !coupon.active) {
      return { ok: false, error: "Invalid coupon code." };
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { ok: false, error: "Coupon code has expired." };
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { ok: false, error: "Coupon code usage limit reached." };
    }

    if (coupon.type === "percent") {
      discount = subtotal.percentage(Math.min(100, coupon.value));
    } else if (coupon.type === "fixed") {
      discount = Money.fromInr(coupon.value);
    }
    // Discount cannot exceed subtotal
    if (discount.greaterThan(subtotal)) {
      discount = subtotal;
    }
  }

  const rates = await getShippingRates();
  const freeThreshold = Money.fromCents(rates.freeThresholdCents);
  const flatShipping = Money.fromCents(rates.flatShippingCents);
  
  const subtotalAfterDiscount = subtotal.subtract(discount);
  const shipping = subtotalAfterDiscount.greaterThan(freeThreshold) || subtotalAfterDiscount.equals(freeThreshold)
    ? Money.fromCents(0)
    : flatShipping;
    
  const total = subtotalAfterDiscount.add(TAX).add(shipping);

  return {
    ok: true,
    cart: {
      lines,
      subtotalCents: subtotal.cents,
      taxCents: TAX.cents,
      shippingCents: shipping.cents,
      totalCents: total.cents,
      couponCode: normalizedCoupon,
      discountCents: discount.cents > 0 ? discount.cents : undefined
    }
  };
}
