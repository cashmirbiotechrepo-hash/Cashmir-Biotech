const DEFAULT_COMPANY_STATE = "Jammu and Kashmir";

function normalizeStateName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function companyState(): string {
  return process.env.COMPANY_STATE?.trim() || DEFAULT_COMPANY_STATE;
}

export type GstSplit = {
  taxType: "intra" | "inter";
  cgstCents: number;
  sgstCents: number;
  igstCents: number;
};

/**
 * Split total GST into CGST/SGST (intra-state) or IGST (inter-state).
 * CGST + SGST always equals taxCents (remainder goes to SGST).
 */
export function splitGstCents(taxCents: number, placeOfSupply: string): GstSplit {
  const tax = Math.max(0, Math.floor(taxCents));
  const isIntra =
    normalizeStateName(placeOfSupply || companyState()) === normalizeStateName(companyState());

  if (isIntra) {
    const cgstCents = Math.floor(tax / 2);
    const sgstCents = tax - cgstCents;
    return { taxType: "intra", cgstCents, sgstCents, igstCents: 0 };
  }

  return { taxType: "inter", cgstCents: 0, sgstCents: 0, igstCents: tax };
}
