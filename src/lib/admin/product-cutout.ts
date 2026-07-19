import "server-only";
import sharp from "sharp";

/**
 * Converts studio product photos (product on a white/near-white backdrop) into
 * transparent-background WebP cutouts so storefront cards can place the product
 * directly on themed surfaces (light or dark) instead of a baked-in white box.
 *
 * Background removal is a flood fill seeded from the image borders: only
 * near-white regions *connected to the edge* become transparent, so white
 * labels and caps inside the product are preserved.
 */

const MAX_EDGE = 1400;
/** Channel floor for a pixel to count as white backdrop. */
const WHITE_THRESHOLD = 232;
/** Below this share of background pixels the shot isn't studio-on-white — keep original. */
const MIN_BG_FRACTION = 0.12;
/** Above this share there is no meaningful subject — keep original. */
const MAX_BG_FRACTION = 0.985;
/** Padding added around the subject crop, as a fraction of subject size. */
const CROP_PAD = 0.07;

export type CutoutResult = {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
};

export async function cutoutWhiteBackground(input: Buffer): Promise<CutoutResult | null> {
  let data: Buffer;
  let width: number;
  let height: number;
  try {
    const raw = await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = raw.data;
    width = raw.info.width;
    height = raw.info.height;
  } catch {
    return null;
  }

  const n = width * height;
  const isBg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let stackTop = 0;

  const isWhite = (i: number) => {
    const o = i * 4;
    return (
      data[o]! >= WHITE_THRESHOLD &&
      data[o + 1]! >= WHITE_THRESHOLD &&
      data[o + 2]! >= WHITE_THRESHOLD
    );
  };
  const seed = (i: number) => {
    if (!isBg[i] && isWhite(i)) {
      isBg[i] = 1;
      stack[stackTop++] = i;
    }
  };

  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (stackTop > 0) {
    const i = stack[--stackTop]!;
    const x = i % width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i < n - width) seed(i + width);
  }

  let bgCount = 0;
  for (let i = 0; i < n; i++) bgCount += isBg[i]!;
  const bgFraction = bgCount / n;
  if (bgFraction < MIN_BG_FRACTION || bgFraction > MAX_BG_FRACTION) return null;

  // Knock out background, track the subject bounding box.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < n; i++) {
    if (isBg[i]) {
      data[i * 4 + 3] = 0;
    } else {
      const x = i % width;
      const y = (i / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || maxX - minX < 8 || maxY - minY < 8) return null;

  // Feather: soften subject pixels that touch the removed background so the
  // cutout doesn't have a hard aliased rim (white fringe on dark surfaces).
  for (let i = 0; i < n; i++) {
    if (isBg[i]) continue;
    const x = i % width;
    const y = (i / width) | 0;
    const touchesBg =
      (x > 0 && isBg[i - 1]!) ||
      (x < width - 1 && isBg[i + 1]!) ||
      (y > 0 && isBg[i - width]!) ||
      (y < height - 1 && isBg[i + width]!);
    if (!touchesBg) continue;
    const o = i * 4;
    // Whiter edge pixels are mostly backdrop bleed — fade them out harder.
    const brightness = Math.min(data[o]!, data[o + 1]!, data[o + 2]!);
    data[o + 3] = brightness >= WHITE_THRESHOLD - 12 ? 90 : 170;
  }

  const padX = Math.round((maxX - minX + 1) * CROP_PAD);
  const padY = Math.round((maxY - minY + 1) * CROP_PAD);
  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const cropW = Math.min(width - left, maxX - minX + 1 + padX * 2);
  const cropH = Math.min(height - top, maxY - minY + 1 + padY * 2);

  try {
    const buffer = await sharp(data, { raw: { width, height, channels: 4 } })
      .extract({ left, top, width: cropW, height: cropH })
      .webp({ quality: 90, alphaQuality: 90, effort: 4 })
      .toBuffer();
    return { buffer, contentType: "image/webp", extension: "webp" };
  } catch {
    return null;
  }
}

export { CUTOUT_SUFFIX, isCutoutUrl } from "@/lib/product-image";
