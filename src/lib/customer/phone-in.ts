export type ParseIndianMobileResult =
  | { ok: true; digits: string; display: string }
  | { ok: false; error: string };

/**
 * India-only P0 mobile parse: 10 digits, optional +91 / 91 prefix.
 * Stores/compares as 10-digit national number.
 */
export function parseIndianMobile(input: string): ParseIndianMobileResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a mobile number." };

  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) {
    return { ok: false, error: "Enter a valid 10-digit Indian mobile number." };
  }
  if (!/^[6-9]/.test(digits)) {
    return { ok: false, error: "Enter a valid Indian mobile number." };
  }

  return { ok: true, digits, display: digits };
}

/** Digits-only phone for match keys (strips leading 91 when 12 digits). */
export function normalizePhoneForMatch(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}
