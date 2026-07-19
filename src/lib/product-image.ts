/**
 * Client-safe helpers for product imagery. Cutout processing itself lives in
 * `@/lib/admin/product-cutout` (server-only, sharp).
 */

/** Transparent-background cutouts are tagged in the filename so the storefront can tell them from legacy flat photos. */
export const CUTOUT_SUFFIX = "-cut";

export function isCutoutUrl(url: string): boolean {
  return url.includes(`${CUTOUT_SUFFIX}.webp`);
}
