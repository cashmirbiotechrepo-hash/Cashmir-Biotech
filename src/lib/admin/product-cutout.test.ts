import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cutoutWhiteBackground } from "@/lib/admin/product-cutout";
import { isCutoutUrl } from "@/lib/product-image";

async function solid(width: number, height: number, rgb: { r: number; g: number; b: number }) {
  return sharp({ create: { width, height, channels: 3, background: rgb } }).png().toBuffer();
}

/** White studio canvas with a centered dark "product" square. */
async function studioShot(size = 400, product = 160) {
  const inset = (size - product) / 2;
  return sharp({ create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([
      {
        input: await solid(product, product, { r: 40, g: 60, b: 45 }),
        left: inset,
        top: inset
      }
    ])
    .png()
    .toBuffer();
}

async function alphaAt(webp: Buffer, xFrac: number, yFrac: number) {
  const { data, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const x = Math.min(info.width - 1, Math.floor(info.width * xFrac));
  const y = Math.min(info.height - 1, Math.floor(info.height * yFrac));
  return data[(y * info.width + x) * 4 + 3]!;
}

describe("cutoutWhiteBackground", () => {
  it("makes the white backdrop transparent and keeps the product opaque", async () => {
    const result = await cutoutWhiteBackground(await studioShot());
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/webp");

    // Corners were backdrop → transparent; center is product → opaque.
    expect(await alphaAt(result!.buffer, 0.01, 0.01)).toBe(0);
    expect(await alphaAt(result!.buffer, 0.99, 0.99)).toBe(0);
    expect(await alphaAt(result!.buffer, 0.5, 0.5)).toBe(255);
  });

  it("crops to the subject instead of keeping the full canvas", async () => {
    const result = await cutoutWhiteBackground(await studioShot(400, 160));
    const meta = await sharp(result!.buffer).metadata();
    // Subject is 160px + ~7% padding — far smaller than the 400px canvas.
    expect(meta.width!).toBeLessThan(220);
    expect(meta.width!).toBeGreaterThan(160);
  });

  it("preserves white areas enclosed inside the product (labels)", async () => {
    const size = 400;
    const base = sharp({ create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .composite([
        { input: await solid(200, 200, { r: 30, g: 30, b: 30 }), left: 100, top: 100 },
        // White label fully enclosed by the dark product.
        { input: await solid(80, 80, { r: 255, g: 255, b: 255 }), left: 160, top: 160 }
      ])
      .png();
    const result = await cutoutWhiteBackground(await base.toBuffer());
    expect(result).not.toBeNull();
    // Center of the label — white but unreachable from the border — stays opaque.
    expect(await alphaAt(result!.buffer, 0.5, 0.5)).toBe(255);
  });

  it("returns null for photos without a white backdrop", async () => {
    const grey = await solid(400, 400, { r: 120, g: 120, b: 120 });
    expect(await cutoutWhiteBackground(grey)).toBeNull();
  });

  it("returns null for blank all-white images", async () => {
    const blank = await solid(400, 400, { r: 255, g: 255, b: 255 });
    expect(await cutoutWhiteBackground(blank)).toBeNull();
  });
});

describe("isCutoutUrl", () => {
  it("detects cutout uploads by filename tag", () => {
    expect(isCutoutUrl("https://cdn.example.com/uploads/abc-cut.webp")).toBe(true);
    expect(isCutoutUrl("/uploads/abc.webp")).toBe(false);
    expect(isCutoutUrl("/uploads/abc.jpg")).toBe(false);
  });
});
