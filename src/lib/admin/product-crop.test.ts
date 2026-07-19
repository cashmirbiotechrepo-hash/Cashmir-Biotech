import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { autoCropWhitespace } from "@/lib/admin/product-crop";
import { CROP_SUFFIX, isProcessedProductImageUrl } from "@/lib/product-image";

/** Studio shot: white canvas with an opaque "bottle" rectangle in the middle. */
async function studioShot(opts: {
  canvas: number;
  subjectW: number;
  subjectH: number;
  color?: { r: number; g: number; b: number };
}): Promise<Buffer> {
  const { canvas, subjectW, subjectH, color = { r: 60, g: 80, b: 100 } } = opts;
  const subject = await sharp({
    create: { width: subjectW, height: subjectH, channels: 3, background: color }
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: canvas, height: canvas, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .composite([{ input: subject, gravity: "centre" }])
    .png()
    .toBuffer();
}

describe("autoCropWhitespace", () => {
  it("crops to a 1:1 square where the subject fills ~75-85% of its dominant axis", async () => {
    const input = await studioShot({ canvas: 1000, subjectW: 300, subjectH: 500 });
    const result = await autoCropWhitespace(input);
    expect(result).not.toBeNull();

    const meta = await sharp(result!.buffer).metadata();
    // Subject 500 tall + 8% padding per side => ~580, expanded to a 580x580 square.
    expect(meta.width).toBe(meta.height);
    expect(meta.height).toBeGreaterThanOrEqual(570);
    expect(meta.height).toBeLessThanOrEqual(590);
    // Dominant axis lands in the requested 75-85% band.
    expect(500 / meta.height!).toBeGreaterThan(0.75);
    expect(500 / meta.height!).toBeLessThan(0.9);
  });

  it("preserves the photograph: opaque output, backdrop stays white, subject color unchanged", async () => {
    const input = await studioShot({
      canvas: 800,
      subjectW: 200,
      subjectH: 200,
      color: { r: 120, g: 40, b: 40 }
    });
    const result = await autoCropWhitespace(input);
    expect(result).not.toBeNull();

    const { data, info } = await sharp(result!.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3); // no alpha, no transparency

    // Corner pixel is the original white backdrop (allow webp encode wiggle).
    expect(data[0]).toBeGreaterThan(250);
    expect(data[1]).toBeGreaterThan(250);
    expect(data[2]).toBeGreaterThan(250);

    // Center pixel keeps the subject's original color.
    const cx = Math.floor(info.width / 2);
    const cy = Math.floor(info.height / 2);
    const o = (cy * info.width + cx) * info.channels;
    expect(Math.abs(data[o]! - 120)).toBeLessThan(8);
    expect(Math.abs(data[o + 1]! - 40)).toBeLessThan(8);
    expect(Math.abs(data[o + 2]! - 40)).toBeLessThan(8);
  });

  it("leaves already tightly framed photos untouched", async () => {
    const input = await studioShot({ canvas: 500, subjectW: 460, subjectH: 460 });
    expect(await autoCropWhitespace(input)).toBeNull();
  });

  it("leaves non-white-backdrop photos untouched", async () => {
    const input = await sharp({
      create: { width: 600, height: 600, channels: 3, background: { r: 140, g: 150, b: 160 } }
    })
      .png()
      .toBuffer();
    expect(await autoCropWhitespace(input)).toBeNull();
  });

  it("flattens legacy transparent cutouts back onto a white backdrop", async () => {
    const subject = await sharp({
      create: { width: 200, height: 400, channels: 3, background: { r: 50, g: 90, b: 60 } }
    })
      .png()
      .toBuffer();
    const cutout = await sharp({
      create: { width: 300, height: 500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: subject, gravity: "centre" }])
      .png()
      .toBuffer();

    const result = await autoCropWhitespace(cutout);
    expect(result).not.toBeNull();

    const { data, info } = await sharp(result!.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    // Former transparent corner is now solid white.
    expect(data[0]).toBeGreaterThan(250);
    expect(data[1]).toBeGreaterThan(250);
    expect(data[2]).toBeGreaterThan(250);
  });

  it("returns null for invalid image data", async () => {
    expect(await autoCropWhitespace(Buffer.from("not an image"))).toBeNull();
  });
});

describe("isProcessedProductImageUrl", () => {
  it("recognises cropped files and not legacy cutouts", () => {
    expect(isProcessedProductImageUrl(`https://cdn.example.com/uploads/abc${CROP_SUFFIX}.webp`)).toBe(true);
    expect(isProcessedProductImageUrl("https://cdn.example.com/uploads/abc-cut.webp")).toBe(false);
    expect(isProcessedProductImageUrl("https://cdn.example.com/uploads/abc.jpg")).toBe(false);
  });
});
