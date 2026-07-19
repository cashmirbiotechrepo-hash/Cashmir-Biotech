import "server-only";
import sharp from "sharp";

/**
 * Content-aware whitespace crop for product photos.
 *
 * This is a GEOMETRY operation, not image processing: the photograph itself —
 * lighting, shadows, reflections, exposure, white backdrop — is preserved
 * pixel-for-pixel. We only find where the product is and cut away the wasted
 * empty canvas around it, leaving a small margin so the subject fills roughly
 * 75–85% of the frame. The crop is expanded to a 1:1 square (using the photo's
 * own surrounding pixels) so storefront cards can show it edge-to-edge with no
 * letterboxing.
 *
 * Transparent inputs (including cutouts from the retired background-removal
 * pipeline) are flattened onto white first, which restores a clean studio
 * backdrop before cropping.
 */

const MAX_EDGE = 1600;
/** A pixel whose darkest channel is below this is considered subject (soft shadows count as subject, so they are kept). */
const SUBJECT_THRESHOLD = 238;
/** Margin around the subject, as a fraction of the subject's size per side. */
const CROP_PAD = 0.08;
/** If the subject already spans this share of both axes, the photo is tight enough — skip. */
const ALREADY_TIGHT = 0.82;
/** Require some meaningful whitespace savings before re-encoding (avoid churn). */
const MIN_AREA_SAVING = 0.08;

export type CropResult = {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
};

export async function autoCropWhitespace(input: Buffer): Promise<CropResult | null> {
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

  // Subject bounding box: everything that isn't near-white canvas or transparent.
  // Transparent pixels (e.g. legacy cutouts) count as canvas and force a
  // flatten-to-white re-encode even when no crop is needed.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let hasTransparency = false;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const o = row + x * 4;
      const alpha = data[o + 3]!;
      if (alpha < 250) hasTransparency = true;
      if (alpha < 40) continue;
      const darkest = Math.min(data[o]!, data[o + 1]!, data[o + 2]!);
      if (darkest < SUBJECT_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const subjectW = maxX - minX + 1;
  const subjectH = maxY - minY + 1;
  if (maxX < 0 || subjectW < 16 || subjectH < 16) return null;

  const alreadyTight = subjectW / width >= ALREADY_TIGHT && subjectH / height >= ALREADY_TIGHT;

  const padX = Math.round(subjectW * CROP_PAD);
  const padY = Math.round(subjectH * CROP_PAD);
  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const cropW = Math.min(width - left, subjectW + padX * 2);
  const cropH = Math.min(height - top, subjectH + padY * 2);

  // Storefront frames are 1:1, so grow the crop to a square using REAL photo
  // pixels (the shot's own backdrop) — never synthetic fill. Centered on the
  // subject, clamped to the image, and never cutting into the padded subject.
  const side = Math.max(cropW, cropH);
  const sqW = Math.min(side, width);
  const sqH = Math.min(side, height);
  let sqLeft = Math.round((minX + maxX) / 2 - sqW / 2);
  let sqTop = Math.round((minY + maxY) / 2 - sqH / 2);
  sqLeft = Math.min(Math.max(sqLeft, 0), width - sqW);
  sqTop = Math.min(Math.max(sqTop, 0), height - sqH);
  if (sqLeft > left) sqLeft = left;
  if (sqLeft + sqW < left + cropW) sqLeft = left + cropW - sqW;
  if (sqTop > top) sqTop = top;
  if (sqTop + sqH < top + cropH) sqTop = top + cropH - sqH;

  const meaningfulCrop = (sqW * sqH) / (width * height) <= 1 - MIN_AREA_SAVING;

  // Opaque photo that is already framed well — keep the original file untouched.
  if (!hasTransparency && (alreadyTight || !meaningfulCrop)) return null;

  try {
    let pipeline = sharp(data, { raw: { width, height, channels: 4 } });
    if (!alreadyTight && meaningfulCrop) {
      pipeline = pipeline.extract({ left: sqLeft, top: sqTop, width: sqW, height: sqH });
    }
    const buffer = await pipeline
      .flatten({ background: "#ffffff" })
      .webp({ quality: 92, effort: 4 })
      .toBuffer();
    return { buffer, contentType: "image/webp", extension: "webp" };
  } catch {
    return null;
  }
}

export { CROP_SUFFIX, isProcessedProductImageUrl } from "@/lib/product-image";
