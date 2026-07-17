import "server-only";
import { SITE_CONTACT } from "@/lib/site-contact";
import { EMAIL, emailSiteUrl, emailSupport, escapeHtml } from "@/lib/email/brand";

export type OtpEmailKind = "portal_login" | "admin_2fa" | "order_lookup";

export type OtpEmailInput = {
  kind: OtpEmailKind;
  code: string;
  email?: string;
  orderNumber?: string;
  requestedAt?: Date;
};

export type BuiltOtpEmail = {
  subject: string;
  text: string;
  html: string;
  fromDisplay: string;
};

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
  title: string;
  ctaLabel: string;
  ctaPath: string;
};

function copyFor(kind: OtpEmailKind, orderNumber?: string): KindCopy {
  switch (kind) {
    case "admin_2fa":
      return {
        fromDisplay: "Cashmir Biotech Security",
        subject: "Your Operations Console verification code",
        title: "Your verification code",
        ctaLabel: "Open Operations Console",
        ctaPath: "/admin/login"
      };
    case "order_lookup":
      return {
        fromDisplay: "Cashmir Biotech Customer Portal",
        subject: orderNumber ? `Order lookup code · ${orderNumber}` : "Your order lookup code",
        title: "Your verification code",
        ctaLabel: "Open order lookup",
        ctaPath: "/order/lookup"
      };
    case "portal_login":
    default:
      return {
        fromDisplay: "Cashmir Biotech Customer Portal",
        subject: "Your Customer Portal verification code",
        title: "Your verification code",
        ctaLabel: "Open Customer Portal",
        ctaPath: "/portal/login"
      };
  }
}

/**
 * Short transactional OTP email — code first, minimal chrome.
 */
export function buildOtpEmail(input: OtpEmailInput): BuiltOtpEmail {
  const copy = copyFor(input.kind, input.orderNumber);
  const displayCode = formatOtpCode(input.code);
  const base = emailSiteUrl();
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
  const support = emailSupport();
  const masked = input.email ? maskEmail(input.email) : null;
  const { ink, body, mute, canvas, paper, line, accent } = EMAIL;

  const text = [
    "Cashmir Biotech",
    "",
    copy.title,
    "",
    displayCode,
    "Valid for 10 minutes",
    "",
    copy.ctaLabel,
    ctaUrl,
    "",
    "Valid for 10 minutes · One-time use only · Never share this code",
    masked ? `Requested for ${masked}` : "",
    "",
    "Need help?",
    support,
    `© ${new Date().getFullYear()} ${SITE_CONTACT.company}`
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${canvas};color:${ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Your code is ${escapeHtml(displayCode)} — valid for 10 minutes.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${canvas};padding:16px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:${paper};border:1px solid ${line};">
          <tr><td style="height:2px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <img src="${escapeHtml(logoUrl)}" alt="Cashmir Biotech" width="48" height="39" style="display:block;border:0;width:48px;height:auto;" />
              <p style="margin:8px 0 0;font-size:13px;font-weight:600;color:${ink};">Cashmir Biotech</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <h1 style="margin:0;font-size:18px;line-height:1.3;font-weight:600;color:${ink};">${escapeHtml(copy.title)}</h1>
              ${
                masked
                  ? `<p style="margin:6px 0 0;font-size:13px;color:${mute};">For ${escapeHtml(masked)}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 24px 8px;">
              <p style="margin:0;font-size:36px;line-height:1.1;letter-spacing:0.22em;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${ink};">
                ${escapeHtml(displayCode)}
              </p>
              <p style="margin:12px 0 0;font-size:13px;color:${body};">Valid for 10 minutes</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 0;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${ink};color:${paper};text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">
                ${escapeHtml(copy.ctaLabel)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:${mute};">
                Valid for 10 minutes<br />
                One-time use only<br />
                Never share this code
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 24px;">
              <p style="margin:0;font-size:13px;color:${body};">Need help? <a href="mailto:${escapeHtml(support)}" style="color:${ink};">${escapeHtml(support)}</a></p>
              <p style="margin:10px 0 0;font-size:12px;color:${mute};">© ${new Date().getFullYear()} ${escapeHtml(SITE_CONTACT.company)}</p>
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
