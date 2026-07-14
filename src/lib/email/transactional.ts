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
    meta: [item.sizeLabel, "Patent-backed", "Batch verified"].filter(Boolean).join(" · "),
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

/** Premium shipping notification — from Cashmir Biotech Orders */
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
  if (input.trackingNumber) shipRows.push({ label: "Tracking number", value: input.trackingNumber });
  shipRows.push({ label: "Estimated delivery", value: estimateDeliveryWindow() });

  const secondary = [
    { label: "View order", href: orderUrl },
    { label: "Customer Portal", href: `${base}/portal/login` },
    { label: "Contact support", href: `${base}/contact` }
  ];
  if (input.invoicePdfUrl) {
    secondary.unshift({ label: "Download invoice", href: absoluteAssetUrl(input.invoicePdfUrl)! });
  }

  const sections: Section[] = [
    {
      type: "hero",
      eyebrow: "Orders & shipping",
      title: "Shipment confirmed",
      subtitle: `${first} is on its way. Your formula has left our facility — quality verified, packed, and handed to our logistics partner.`
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
    {
      type: "text",
      body: `Order ${input.orderNumber}${input.customerName ? `\nHi ${input.customerName}` : ""}`
    },
    { type: "card", title: "Shipment", rows: shipRows },
    {
      type: "cta",
      label: primaryCta.label,
      href: primaryCta.href,
      secondary
    },
    ...orderSummarySections(input)
  ];

  const shipTo = addressLines(input.shippingAddress, input.customerName);
  if (shipTo.length > 0) {
    sections.push({ type: "address", title: "Shipping to", lines: shipTo });
  }

  sections.push({
    type: "checklist",
    title: "Quality assurance",
    items: [
      "Batch verified",
      "Patent-backed formulation",
      "GMP manufacturing",
      "Laboratory release approved"
    ]
  });

  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Orders",
    subject: "Your order has shipped",
    preheader: `${first} is on its way · ${input.orderNumber}`,
    sections,
    legalNote:
      "This email was sent regarding your Cashmir Biotech order. Invoice and documents are available in your Customer Portal."
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
      eyebrow: "Orders",
      title: "Order confirmed",
      subtitle: `Thank you${input.customerName ? `, ${input.customerName}` : ""}. We've received payment for ${first} and will notify you when it ships.`
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
    { type: "text", body: `Order ${input.orderNumber}` },
    ...orderSummarySections(input)
  ];

  const shipTo = addressLines(input.shippingAddress, input.customerName);
  if (shipTo.length > 0) {
    sections.push({ type: "address", title: "Shipping to", lines: shipTo });
  }

  sections.push(
    {
      type: "cta",
      label: "View order",
      href: orderUrl,
      secondary: [
        { label: "Open Customer Portal", href: `${base}/portal/login` },
        { label: "Contact support", href: `${base}/contact` }
      ]
    },
    {
      type: "checklist",
      title: "What happens next",
      items: [
        "We verify batch and prepare your formulation",
        "You'll receive tracking when it ships",
        "Invoices and CoAs live in your Customer Portal"
      ]
    }
  );

  return buildBrandedMail({
    fromDisplay: "Cashmir Biotech Orders",
    subject: "Order confirmed",
    preheader: `Thank you — ${input.orderNumber} is confirmed`,
    sections,
    legalNote: "This email confirms your Cashmir Biotech purchase. Keep it for your records."
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
    preheader: `₹${(input.amountCents / 100).toFixed(0)} refund for ${input.orderNumber}`,
    sections: [
      {
        type: "hero",
        eyebrow: "Orders",
        title: "Refund processed",
        subtitle: `A refund of ${formatInr(input.amountCents)} for order ${input.orderNumber} has been initiated. Funds typically return in 5–7 business days.`
      },
      {
        type: "card",
        title: "Refund details",
        rows: [
          { label: "Order", value: input.orderNumber },
          { label: "Amount", value: formatInr(input.amountCents) },
          { label: "Reason", value: input.reason }
        ]
      },
      {
        type: "cta",
        label: "View order",
        href: orderUrl,
        secondary: [{ label: "Contact support", href: `${base}/contact` }]
      }
    ],
    legalNote: "This email was sent regarding a refund on your Cashmir Biotech order."
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
        eyebrow: "Organisation",
        title: "You're invited",
        subtitle: `Join ${input.orgName} as ${input.role} on the Cashmir Biotech Customer Portal.`
      },
      {
        type: "cta",
        label: "Accept invite",
        href: input.acceptUrl,
        secondary: [{ label: "Contact support", href: `${emailSiteUrl()}/contact` }]
      },
      {
        type: "text",
        body: "This invite expires in 7 days. If you did not expect this message, you can safely ignore it."
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
        eyebrow: "Inventory alert",
        title: "Low stock",
        subtitle: `${input.productName} has reached or fallen below the configured threshold.`
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
        eyebrow: "Customer Portal",
        title: "New support message",
        subtitle: `From ${input.fromEmail}`
      },
      { type: "text", body: input.body },
      {
        type: "cta",
        label: "Open support console",
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
        eyebrow: "Website enquiry",
        title: "New contact message",
        subtitle: `${input.name} wrote from the Cashmir Biotech website.`
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
        label: "Reply by email",
        href: `mailto:${encodeURIComponent(input.email)}`
      }
    ]
  });
}
