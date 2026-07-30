import { SITE_CONTACT } from "@/lib/site-contact";

export type CompanyLegal = {
  cin: string;
  pan: string;
  gstin: string;
};

/** Resolved company registration — env vars may override for staging. */
export function companyLegal(): CompanyLegal {
  return {
    cin: process.env.COMPANY_CIN?.trim() || SITE_CONTACT.legal.cin,
    pan: process.env.COMPANY_PAN?.trim() || SITE_CONTACT.legal.pan,
    gstin: process.env.COMPANY_GSTIN?.trim() || SITE_CONTACT.legal.gstin
  };
}

export function companyLegalConfigured(): boolean {
  const { gstin } = companyLegal();
  return gstin.length >= 5;
}

/** Standard document lines for invoices and footers. */
export function companyLegalLines(): string[] {
  const { cin, pan, gstin } = companyLegal();
  return [`GSTIN ${gstin}`, `PAN ${pan}`, `CIN ${cin}`];
}
