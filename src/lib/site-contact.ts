/** Canonical contact details for storefront, PDFs, and support. */
export const SITE_CONTACT = {
  company: "Cashmir Biotech Pvt Ltd",
  emails: ["cashmirbiotech@gmail.com", "admin@cashmirbiotech.com"] as const,
  primaryEmail: "cashmirbiotech@gmail.com",
  supportEmail: "support@cashmirbiotech.com",
  dpoEmail: "dpo@cashmirbiotech.com",
  phone: "09103 524624",
  phoneTel: "+919103524624",
  /** Short location for compact UI */
  location: "Srinagar, Jammu & Kashmir, India",
  /** Full registered / document address (invoice Sold By, footers) */
  addressLines: [
    "1201, Srinagar Bypass Road",
    "Near Sanat Nagar Park",
    "Rawalpora",
    "Srinagar",
    "Jammu & Kashmir – 190014",
    "India"
  ] as const,
  mapsUrl:
    "https://www.google.com/maps/place/Cashmir+BioTech/@34.1452997,74.8782259,17z"
} as const;
