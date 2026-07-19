/**
 * Client-safe helpers for product imagery. The crop processing itself lives in
 * `@/lib/admin/product-crop` (server-only, sharp).
 */

/**
 * Auto-cropped photos are tagged in the filename so reprocessing can skip them.
 * (Legacy `-cut.webp` cutouts from the retired background-removal pipeline are
 * NOT tagged as processed — reprocessing flattens them back onto white.)
 */
export const CROP_SUFFIX = "-crop";

/** True when the URL points at an image this pipeline already produced. */
export function isProcessedProductImageUrl(url: string): boolean {
  return url.includes(`${CROP_SUFFIX}.webp`);
}
