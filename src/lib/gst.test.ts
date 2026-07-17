import { describe, expect, it } from "vitest";
import { splitGstCents } from "@/lib/gst";

describe("splitGstCents", () => {
  it("splits odd tax remainder into SGST for intra-state", () => {
    const split = splitGstCents(101, "Jammu and Kashmir");
    expect(split.taxType).toBe("intra");
    expect(split.cgstCents + split.sgstCents).toBe(101);
    expect(split.cgstCents).toBe(50);
    expect(split.sgstCents).toBe(51);
    expect(split.igstCents).toBe(0);
  });

  it("uses IGST for inter-state supply", () => {
    const split = splitGstCents(1800, "Maharashtra");
    expect(split.taxType).toBe("inter");
    expect(split.igstCents).toBe(1800);
    expect(split.cgstCents).toBe(0);
    expect(split.sgstCents).toBe(0);
  });

  it("treats Jammu & Kashmir variants as intra-state", () => {
    const split = splitGstCents(100, "Jammu & Kashmir");
    expect(split.taxType).toBe("intra");
    expect(split.cgstCents + split.sgstCents).toBe(100);
  });
});
