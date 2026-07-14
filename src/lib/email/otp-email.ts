import "server-only";
import { SITE_CONTACT } from "@/lib/site-contact";

export type OtpEmailKind = "portal_login" | "admin_2fa" | "order_lookup";

export type OtpEmailInput = {
  kind: OtpEmailKind;
  code: string;
  /** Recipient email — used for masked confirmation line */
  email?: string;
  orderNumber?: string;
  requestedAt?: Date;
};

export type BuiltOtpEmail = {
  subject: string;
  text: string;
  html: string;
  /** Display-name part for the From header */
  fromDisplay: string;
};

const GOLD = "#b89458";
const INK = "#18181b";
const MUTE = "#71717a";
const FAINT = "#a1a1aa";
const IVORY = "#fbfbf9";
const PAPER = "#ffffff";
const LINE = "#e4e4e7";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://cashmirbiotech.com").replace(/\/$/, "");
}

function supportEmail() {
  return SITE_CONTACT.supportEmail || SITE_CONTACT.primaryEmail;
}

/** Mask email for trust line: mo***@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return "your account";
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Visual OTP: 537245 → 537 245 */
export function formatOtpCode(code: string): string {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) return code;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

type KindCopy = {
  fromDisplay: string;
  subject: string;
  eyebrow: string;
  heading: string;
  intro: string;
  accessLabel: string;
  accessItems: string[];
  ctaLabel: string;
  ctaPath: string;
  securityExtra?: string;
};

function copyFor(kind: OtpEmailKind, orderNumber?: string): KindCopy {
  switch (kind) {
    case "admin_2fa":
      return {
        fromDisplay: "Cashmir Biotech Security",
        subject: "Operations Console — verification code",
        eyebrow: "Operations Console",
        heading: "Administrator verification",
        intro:
          "A sign-in to the Cashmir Biotech Operations Console requested a one-time verification code. Enter the code below to continue.",
        accessLabel: "This protects access to",
        accessItems: [
          "Orders & fulfilment",
          "Inventory & lots",
          "Finance & invoices",
          "Patents & CRM",
          "User roles & audit logs"
        ],
        ctaLabel: "Continue to Operations Console",
        ctaPath: "/admin/login",
        securityExtra: "Administrator codes are time-limited and monitored."
      };
    case "order_lookup":
      return {
        fromDisplay: "Cashmir Biotech Customer Portal",
        subject: orderNumber
          ? `Order lookup code · ${orderNumber}`
          : "Order lookup — verification code",
        eyebrow: "Order Lookup",
        heading: "Secure order access",
        intro: orderNumber
          ? `You requested a one-time code to view order ${orderNumber}. Enter it on the order lookup page to open your confirmation, invoices, and tracking.`
          : "You requested a one-time code to look up an order. Enter it on the order lookup page to continue.",
        accessLabel: "With this code you can view",
        accessItems: [
          "Order confirmation",
          "Shipping status",
          "GST invoice & packing slip",
          "Receipt details"
        ],
        ctaLabel: "Open order lookup",
        ctaPath: "/order/lookup",
        securityExtra: "Only the most recent code will work if several were requested."
      };
    case "portal_login":
    default:
      return {
        fromDisplay: "Cashmir Biotech Customer Portal",
        subject: "Customer Portal — secure sign-in code",
        eyebrow: "Customer Portal",
        heading: "Secure sign-in requested",
        intro:
          "You requested a one-time verification code to access your Cashmir Biotech Customer Portal. Enter the code to continue — no password required.",
        accessLabel: "Use this code to securely access",
        accessItems: [
          "Order history",
          "Shipping & tracking",
          "GST invoices & receipts",
          "Certificates & batch documents",
          "Saved addresses & support"
        ],
        ctaLabel: "Continue to Customer Portal",
        ctaPath: "/portal/login",
        securityExtra: "Only the most recent code will work if several were requested."
      };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds a branded HTML + plain-text OTP email for any authentication code send.
 * Table-based layout for Gmail / Outlook / Apple Mail compatibility.
 */
export function buildOtpEmail(input: OtpEmailInput): BuiltOtpEmail {
  const copy = copyFor(input.kind, input.orderNumber);
  const displayCode = formatOtpCode(input.code);
  const rawCode = input.code.replace(/\D/g, "").slice(0, 6) || input.code;
  const base = siteUrl();
  let ctaUrl = `${base}${copy.ctaPath}`;
  if (input.kind === "portal_login" && input.email) {
    ctaUrl += `?email=${encodeURIComponent(input.email)}`;
  }
  if (input.kind === "order_lookup" && input.orderNumber) {
    const qs = new URLSearchParams();
    if (input.email) qs.set("email", input.email);
    qs.set("orderNumber", input.orderNumber);
    ctaUrl += `?${qs.toString()}`;
  }
  const logoUrl = `${base}/logo.png`;
  const when = (input.requestedAt ?? new Date()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  });
  const masked = input.email ? maskEmail(input.email) : null;
  const support = supportEmail();

  const text = [
    "CASHMIR BIOTECH",
    copy.eyebrow.toUpperCase(),
    "",
    copy.heading,
    "",
    copy.intro,
    masked ? `Sign-in requested for ${masked}.` : "",
    `Requested: ${when} (IST)`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    displayCode,
    "Valid for 10 minutes",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    `${copy.accessLabel}:`,
    ...copy.accessItems.map((i) => `• ${i}`),
    "",
    `${copy.ctaLabel}:`,
    ctaUrl,
    "",
    "Security",
    "• This is a one-time code and can only be used once.",
    "• It expires automatically in 10 minutes.",
    "• Never share this code with anyone.",
    "• Cashmir Biotech will never ask you for this code.",
    copy.securityExtra ? `• ${copy.securityExtra}` : "",
    "",
    "If you did not request this sign-in:",
    "• Ignore this email",
    "• Your account remains secure",
    "• No action is required",
    "",
    "Need help?",
    support,
    base,
    "",
    "Cashmir Biotech",
    "Research-driven biotechnology from the Himalaya.",
    `© ${new Date().getFullYear()} ${SITE_CONTACT.company}`,
    SITE_CONTACT.location
  ]
    .filter((line) => line !== "")
    .join("\n");

  const accessRows = copy.accessItems
    .map(
      (item) =>
        `<tr><td style="padding:4px 0;font-size:14px;line-height:1.5;color:${MUTE};">• ${escapeHtml(item)}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${IVORY};color:${INK};font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Your Cashmir Biotech code is ${escapeHtml(displayCode)} — valid for 10 minutes.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${PAPER};border:1px solid ${LINE};">
          <tr>
            <td style="height:3px;background:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 40px 28px;">
              <img src="${escapeHtml(logoUrl)}" alt="Cashmir Biotech" width="160" height="auto" style="display:block;border:0;max-width:160px;height:auto;" />
              <p style="margin:24px 0 0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${GOLD};font-weight:600;">
                ${escapeHtml(copy.eyebrow)}
              </p>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;font-weight:300;letter-spacing:-0.02em;color:${INK};">
                ${escapeHtml(copy.heading)}
              </h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:${MUTE};">
                ${escapeHtml(copy.intro)}
              </p>
              ${
                masked
                  ? `<p style="margin:12px 0 0;font-size:13px;color:${FAINT};">Sign-in requested for <span style="color:${INK};">${escapeHtml(masked)}</span></p>`
                  : ""
              }
              <p style="margin:6px 0 0;font-size:12px;color:${FAINT};">Requested ${escapeHtml(when)} (IST)</p>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 40px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};border:1px solid ${LINE};">
                <tr>
                  <td align="center" style="padding:28px 20px 12px;">
                    <p style="margin:0;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${FAINT};">One-time code</p>
                    <p style="margin:14px 0 0;font-size:40px;line-height:1;letter-spacing:0.28em;font-weight:500;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${INK};">
                      ${escapeHtml(displayCode)}
                    </p>
                    <p style="margin:16px 0 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTE};">
                      Valid for <strong style="color:${INK};font-weight:600;">10 minutes</strong>
                    </p>
                    <p style="margin:8px 0 0;font-size:11px;color:${FAINT};">Code: ${escapeHtml(rawCode)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 28px;">
              <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${FAINT};">
                ${escapeHtml(copy.accessLabel)}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${accessRows}
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 40px 36px;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${INK};color:${PAPER};text-decoration:none;font-size:14px;font-weight:500;padding:14px 28px;border-radius:999px;">
                ${escapeHtml(copy.ctaLabel)}
              </a>
              <p style="margin:14px 0 0;font-size:12px;color:${FAINT};">Or copy the code and return to the sign-in screen.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 32px;border-top:1px solid ${LINE};">
              <p style="margin:28px 0 12px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};">Security</p>
              <p style="margin:0;font-size:13px;line-height:1.65;color:${MUTE};">
                ✓ One-time code — can only be used once<br />
                ✓ Expires automatically in 10 minutes<br />
                ✓ Never share this code with anyone<br />
                ✓ Cashmir Biotech will never ask for this code<br />
                ${copy.securityExtra ? `✓ ${escapeHtml(copy.securityExtra)}` : ""}
              </p>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.65;color:${MUTE};">
                <strong style="color:${INK};font-weight:500;">If you did not request this sign-in</strong><br />
                Ignore this email. Your account remains secure. No action is required.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 32px;background:${IVORY};border-top:1px solid ${LINE};">
              <p style="margin:0;font-size:12px;color:${MUTE};">
                Need help? <a href="mailto:${escapeHtml(support)}" style="color:${INK};text-decoration:underline;">${escapeHtml(support)}</a>
              </p>
              <p style="margin:10px 0 0;font-size:12px;">
                <a href="${escapeHtml(base)}" style="color:${MUTE};text-decoration:none;">Website</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(base)}/contact" style="color:${MUTE};text-decoration:none;">Contact</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(base)}/about" style="color:${MUTE};text-decoration:none;">About</a>
              </p>
              <p style="margin:18px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};">Cashmir Biotech</p>
              <p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:${FAINT};">
                Research-driven biotechnology from the Himalaya.<br />
                © ${new Date().getFullYear()} ${escapeHtml(SITE_CONTACT.company)} · ${escapeHtml(SITE_CONTACT.location)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: copy.subject,
    text,
    html,
    fromDisplay: copy.fromDisplay
  };
}
