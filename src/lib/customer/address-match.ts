import { normalizePhoneForMatch } from "@/lib/customer/phone-in";

export type AddressMatchFields = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label?: string;
};

export type NormalizedAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function collapseWs(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function fold(s: string) {
  return collapseWs(s).toLowerCase();
}

export function normalizeAddressFields(input: AddressMatchFields): NormalizedAddress {
  const country = fold(input.country || "India");
  let postal = input.postalCode.replace(/\D/g, "");
  if (country === "india" || country === "in") {
    postal = postal.slice(0, 6);
  }
  return {
    fullName: fold(input.fullName),
    phone: normalizePhoneForMatch(input.phone),
    line1: fold(input.line1),
    line2: fold(input.line2 ?? ""),
    city: fold(input.city),
    state: fold(input.state),
    postalCode: postal,
    country: country || "india"
  };
}

/** Stable canonical string for hashing (server) or equality (client). */
export function addressMatchCanonical(normalized: NormalizedAddress): string {
  return [
    normalized.fullName,
    normalized.phone,
    normalized.line1,
    normalized.line2,
    normalized.city,
    normalized.state,
    normalized.postalCode,
    normalized.country
  ].join("\0");
}

export function addressesMatch(a: AddressMatchFields, b: AddressMatchFields): boolean {
  return addressMatchCanonical(normalizeAddressFields(a)) === addressMatchCanonical(normalizeAddressFields(b));
}

export function collapseAddressWs(s: string) {
  return collapseWs(s);
}
