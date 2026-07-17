import "server-only";
import {
  absoluteAssetUrl,
  buildBrandedMail,
  emailSiteUrl,
  formatInr,
  type BuiltMail,
  type Section
} from "@/lib/email/brand";

export type OrderMailItem = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  imageUrl?: string | null;
  sizeLabel?: string | null;
};

export type ShippingAddress = {
  fullName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
};

function addressLines(addr: ShippingAddress | null | undefined, fallbackName?: string | null): string[] {
  if (!addr) return fallbackName ? [fallbackName] : [];
  return [
    addr.fullName || fallbackName || "",
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", "),
    addr.phone ? `Tel ${addr.phone}` : ""
  ].filter((l): l is string => Boolean(l && String(l).trim()));
}

function trackingHref(carrier: string, trackingNumber: string): string | null {
  const t = encodeURIComponent(trackingNumber.trim());
  if (!t) return null;
  const c = carrier.toLowerCase();
  if (c.includes("blue dart") || c.includes("bluedart")) {
    return `https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo=${t}`;
  }
  if (c.includes("delhivery")) return `https://www.delhivery.com/track/package/${t}`;
  if (c.includes("dtdc")) return `https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=${t}`;
  if (c.includes("india post") || c.includes("speed post")) {
    return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
  }
  return null;
}

function estimateDeliveryWindow(daysMin = 4, daysMax = 7): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const a = new Date();
  a.setDate(a.getDate() + daysMin);
  const b = new Date();
  b.setDate(b.getDate() + daysMax);
  return `${fmt(a)} – ${fmt(b)}`;
}

function productSections(items: OrderMailItem[]): Section[] {
  return items.slice(0, 3).map((item) => ({
    type: "product" as const,
    name: item.productName,
    meta: item.sizeLabel || undefined,
    imageUrl: absoluteAssetUrl(item.imageUrl ?? undefined),
    qty: item.quantity
  }));
}

function orderSummarySections(input: {
  items: OrderMailItem[];
  shippingCents: number;
  discountCents?: number;
  totalCents: number;
}): Section[] {
  const lines = input.items.map((i) => ({
    label: `${i.productName}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`,
    value: formatInr(i.unitPriceCents * i.quantity)
  }));
  if ((input.discountCents ?? 0) > 0) {
    lines.push({ label: "Discount", value: `−${formatInr(input.discountCents!)}` });
  }
  lines.push({
    label: "Shipping",
    value: input.shippingCents === 0 ? "Free" : formatInr(input.shippingCents)
  });
  return [
    {
      type: "summary",
      lines,
      total: { label: "Total", value: formatInr(input.totalCents) }
    }
  ];
}

/** Shipping notification — short transactional layout */
export function buildOrderShippedMail(input: {
  customerName?: string | null;
  orderNumber: string;
  confirmationToken: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  items: OrderMailItem[];
  shippingAddress?: ShippingAddress | null;
  subtotalCents: number;
  shippingCents: number;
  discountCents?: number;
  totalCents: number;
  invoicePdfUrl?: string | null;
}): BuiltMail {
  const base = emailSiteUrl();
  const orderUrl = `${base}/order/${input.orderNumber}?t=${encodeURIComponent(input.confirmationToken)}`;
  const track =
    input.trackingNumber && input.carrier
      ? trackingHref(input.carrier, input.trackingNumber)
      : null;
  const primaryCta = track
    ? { label: "Track shipment", href: track }
    : { label: "View order", href: orderUrl };

  const first = input.items[0]?.productName ?? "Your order";
  const shipRows: Array<{ label: string; value: string }> = [];
  if (input.carrier) shipRows.push({ label: "Carrier", value: input.carrier });
  if (input.trackingNumber) shipRows.push({ label: "Tracking", value: input.trackingNumber });
  shipRows.push({ label: "Est. delivery", value: estimateDeliveryWindow() });

  const secondary = [{ label: "View order", href: orderUrl }];
  if (input.invoicePdfUrl) {
    secondary.push({ label: "Invoice", href: absoluteAssetUrl(input.invoicePdfUrl)! });
  }

  const sections: Section[] = [
    {
      type: "hero",
      title: "Shipment confirmed",
      subtitle: `${first} is on its way · ${input.orderNumber}`
    },
    {
      type: "steps",
      steps: [
        { label: "Ordered", done: true },
        { label: "Packed", done: true },
        { label: "Shipped", done: true },
        { label: "In transit", done: false },
        { label: "Delivered", done: false }
      ]
    },
    ...productSections(input.items),
    { type: "card", title: "Delivery", rows: shipRows }
  ];

  const shipTo = addressLines(input.shippingAddress, input.customerName);
  if (shipTo.length > 0) {
    sections.push({ type: "address", title: "Shipping to", lines: shipTo });
  }

  sections.push(
    {
      type: "cta",
      label: primaryCta.label,
      href: primaryCta.href,
      secondary
    },
    ...orderSummarySections(input)
  );

  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Orders",
    subject: "Your order has shipped",
    preheader: `${first} is on its way · ${input.orderNumber}`,
    sections
  });
}

/** Order paid / confirmation */
export function buildOrderConfirmedMail(input: {
  customerName?: string | null;
  orderNumber: string;
  confirmationToken: string;
  items: OrderMailItem[];
  shippingAddress?: ShippingAddress | null;
  shippingCents: number;
  discountCents?: number;
  totalCents: number;
}): BuiltMail {
  const base = emailSiteUrl();
  const orderUrl = `${base}/order/${input.orderNumber}?t=${encodeURIComponent(input.confirmationToken)}`;
  const first = input.items[0]?.productName ?? "Your order";

  const sections: Section[] = [
    {
      type: "hero",
      title: "Order confirmed",
      subtitle: `Thank you${input.customerName ? `, ${input.customerName}` : ""}. Payment received for ${first} · ${input.orderNumber}`
    },
    {
      type: "steps",
      steps: [
        { label: "Ordered", done: true },
        { label: "Paid", done: true },
        { label: "Preparing", done: false },
        { label: "Shipped", done: false },
        { label: "Delivered", done: false }
      ]
    },
    ...productSections(input.items),
    ...orderSummarySections(input)
  ];

  const shipTo = addressLines(input.shippingAddress, input.customerName);
  if (shipTo.length > 0) {
    sections.push({ type: "address", title: "Shipping to", lines: shipTo });
  }

  sections.push({
    type: "cta",
    label: "View order",
    href: orderUrl
  });

  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Orders",
    subject: "Order confirmed",
    preheader: `Thank you — ${input.orderNumber} is confirmed`,
    sections
  });
}

export function buildRefundMail(input: {
  customerName?: string | null;
  orderNumber: string;
  amountCents: number;
  reason: string;
  confirmationToken?: string;
}): BuiltMail {
  const base = emailSiteUrl();
  const orderUrl = input.confirmationToken
    ? `${base}/order/${input.orderNumber}?t=${encodeURIComponent(input.confirmationToken)}`
    : `${base}/portal/orders`;

  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Orders",
    subject: "Refund processed",
    preheader: `${formatInr(input.amountCents)} refund for ${input.orderNumber}`,
    sections: [
      {
        type: "hero",
        title: "Refund processed",
        subtitle: `${formatInr(input.amountCents)} for order ${input.orderNumber}. Funds typically return in 5–7 business days.`
      },
      {
        type: "card",
        title: "Details",
        rows: [
          { label: "Order", value: input.orderNumber },
          { label: "Amount", value: formatInr(input.amountCents) },
          { label: "Reason", value: input.reason }
        ]
      },
      {
        type: "cta",
        label: "View order",
        href: orderUrl
      }
    ]
  });
}

export function buildOrgInviteMail(input: {
  orgName: string;
  role: string;
  acceptUrl: string;
}): BuiltMail {
  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech",
    subject: `Join ${input.orgName} on Cashmir Biotech`,
    preheader: `You're invited to ${input.orgName}`,
    sections: [
      {
        type: "hero",
        title: "You're invited",
        subtitle: `Join ${input.orgName} as ${input.role}. This invite expires in 7 days.`
      },
      {
        type: "cta",
        label: "Accept invite",
        href: input.acceptUrl
      }
    ]
  });
}

export function buildLowStockMail(input: {
  productName: string;
  sku: string;
  available: number;
  threshold: number;
}): BuiltMail {
  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Operations",
    subject: `Low stock: ${input.productName}`,
    preheader: `${input.productName} is at ${input.available} available`,
    sections: [
      {
        type: "hero",
        title: "Low stock",
        subtitle: `${input.productName} is at or below the threshold.`
      },
      {
        type: "card",
        title: "Details",
        rows: [
          { label: "Product", value: input.productName },
          { label: "SKU", value: input.sku || "—" },
          { label: "Available", value: String(input.available) },
          { label: "Threshold", value: String(input.threshold) }
        ]
      },
      {
        type: "cta",
        label: "Open inventory",
        href: `${emailSiteUrl()}/admin/inventory`
      }
    ]
  });
}

export function buildSupportTicketMail(input: {
  subject: string;
  body: string;
  fromEmail: string;
}): BuiltMail {
  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Portal",
    subject: input.subject.startsWith("[Portal]") ? input.subject : `[Portal] ${input.subject}`,
    preheader: `Support from ${input.fromEmail}`,
    sections: [
      {
        type: "hero",
        title: "New support message",
        subtitle: `From ${input.fromEmail}`
      },
      { type: "text", body: input.body },
      {
        type: "cta",
        label: "Open support",
        href: `${emailSiteUrl()}/admin/support`
      }
    ]
  });
}

export function buildContactLeadMail(input: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
}): BuiltMail {
  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Website",
    subject: `Contact: ${input.name}`,
    preheader: `New enquiry from ${input.name}`,
    sections: [
      {
        type: "hero",
        title: "New contact message",
        subtitle: `${input.name} wrote from the website.`
      },
      {
        type: "card",
        title: "Contact",
        rows: [
          { label: "Name", value: input.name },
          { label: "Email", value: input.email },
          { label: "Phone", value: input.phone || "—" },
          { label: "Company", value: input.company || "—" }
        ]
      },
      { type: "text", body: input.message },
      {
        type: "cta",
        label: "Reply",
        href: `mailto:${encodeURIComponent(input.email)}`
      }
    ]
  });
}
