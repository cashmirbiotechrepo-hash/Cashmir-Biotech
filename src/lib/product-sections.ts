/** Helpers for conditional storefront product-information sections. */

export function hasContent(obj?: Record<string, unknown> | null): boolean {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

export function stripEmptyStrings<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = typeof value === "string" ? value.trim() : value;
  }
  return out as Partial<T>;
}
