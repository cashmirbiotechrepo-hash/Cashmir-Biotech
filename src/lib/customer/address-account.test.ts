import { describe, expect, it } from "vitest";
import { parseIndianMobile, normalizePhoneForMatch } from "@/lib/customer/phone-in";
import {
  addressesMatch,
  addressMatchCanonical,
  normalizeAddressFields
} from "@/lib/customer/address-match";
import { resolveCheckoutAddressMutation } from "@/lib/customer/checkout-address-mutation";
import { createHash } from "crypto";

const base = {
  fullName: "Aisha Khan",
  phone: "+91 98765 43210",
  line1: "12 Dal Lake Road",
  line2: "",
  city: "Srinagar",
  state: "Jammu and Kashmir",
  postalCode: "190001",
  country: "India"
};

describe("parseIndianMobile", () => {
  it("accepts 10-digit mobiles starting 6–9", () => {
    expect(parseIndianMobile("9876543210")).toEqual({
      ok: true,
      digits: "9876543210",
      display: "9876543210"
    });
  });

  it("strips +91 / 91", () => {
    expect(parseIndianMobile("+91 98765 43210").ok && parseIndianMobile("+91 98765 43210").digits).toBe(
      "9876543210"
    );
    expect(parseIndianMobile("919876543210").ok && parseIndianMobile("919876543210").digits).toBe(
      "9876543210"
    );
  });

  it("rejects invalid", () => {
    expect(parseIndianMobile("12345").ok).toBe(false);
    expect(parseIndianMobile("0876543210").ok).toBe(false);
  });
});

describe("address match key", () => {
  it("ignores label and case/whitespace differences", () => {
    const a = { ...base, label: "Home", line1: "12  Dal Lake Road" };
    const b = { ...base, label: "Work", line1: "12 dal lake road" };
    expect(addressesMatch(a, b)).toBe(true);
  });

  it("treats different PIN as different address", () => {
    expect(addressesMatch(base, { ...base, postalCode: "190002" })).toBe(false);
  });

  it("fingerprint canonical is stable for SHA-256", () => {
    const n = normalizeAddressFields(base);
    const hex = createHash("sha256").update(addressMatchCanonical(n)).digest("hex");
    expect(hex).toHaveLength(64);
    expect(normalizePhoneForMatch(base.phone)).toBe("9876543210");
  });
});

describe("resolveCheckoutAddressMutation (chip dirty / consent)", () => {
  it("honors saveAddress=false even on empty book", () => {
    expect(
      resolveCheckoutAddressMutation({
        saveAddress: false,
        selectedAddressId: null,
        label: "Home",
        shipping: base,
        selectedSnapshot: null
      }).kind
    ).toBe("none");
  });

  it("does not overwrite chip row when match-key fields are tweaked", () => {
    const m = resolveCheckoutAddressMutation({
      saveAddress: true,
      selectedAddressId: "addr_1",
      label: "Home",
      shipping: { ...base, line1: "99 New Street" },
      selectedSnapshot: { ...base, label: "Home" }
    });
    expect(m.kind).toBe("upsert");
    if (m.kind === "upsert") {
      expect(m.fields.line1).toBe("99 New Street");
    }
  });

  it("label-only rename updates owned chip row", () => {
    const m = resolveCheckoutAddressMutation({
      saveAddress: true,
      selectedAddressId: "addr_1",
      label: "Flat",
      shipping: base,
      selectedSnapshot: { ...base, label: "Home" }
    });
    expect(m).toEqual({ kind: "label_only", addressId: "addr_1", label: "Flat" });
  });

  it("unchanged chip + save on → no address write", () => {
    expect(
      resolveCheckoutAddressMutation({
        saveAddress: true,
        selectedAddressId: "addr_1",
        label: "Home",
        shipping: base,
        selectedSnapshot: { ...base, label: "Home" }
      }).kind
    ).toBe("none");
  });
});
