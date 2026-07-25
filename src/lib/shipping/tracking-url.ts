/**
 * Carrier tracking deep links for portal + transactional email.
 */
export function trackingHref(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const raw = (trackingNumber ?? "").trim();
  if (!raw) return null;
  const t = encodeURIComponent(raw);
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("blue dart") || c.includes("bluedart")) {
    return `https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo=${t}`;
  }
  if (c.includes("delhivery")) return `https://www.delhivery.com/track/package/${t}`;
  if (c.includes("dtdc")) {
    return `https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=${t}`;
  }
  if (c.includes("india post") || c.includes("speed post")) {
    return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
  }
  // Generic fallback — searchable AWB
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? "tracking"} ${raw}`)}`;
}
