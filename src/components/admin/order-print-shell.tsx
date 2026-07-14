/** Shared helpers for printable order documents. */

export function formatInrCents(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

type DocAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  fullName?: string;
  email?: string;
};

export function addressLines(addr: DocAddress | null | undefined) {
  if (!addr) return [] as string[];
  return [
    addr.fullName,
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", "),
    addr.country,
    addr.phone ? `Phone: ${addr.phone}` : null,
    addr.email ? `Email: ${addr.email}` : null
  ].filter(Boolean) as string[];
}
