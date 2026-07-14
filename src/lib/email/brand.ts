import "server-only";
import { SITE_CONTACT } from "@/lib/site-contact";

export const EMAIL = {
  gold: "#b89458",
  ink: "#18181b",
  mute: "#71717a",
  faint: "#a1a1aa",
  ivory: "#fbfbf9",
  paper: "#ffffff",
  line: "#e4e4e7"
} as const;

export function emailSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://cashmirbiotech.com").replace(/\/$/, "");
}

export function emailSupport() {
  return SITE_CONTACT.supportEmail || SITE_CONTACT.primaryEmail;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatInr(cents: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function absoluteAssetUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  return `${emailSiteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export type BuiltMail = {
  subject: string;
  text: string;
  html: string;
  fromDisplay: string;
};

type Section =
  | { type: "hero"; eyebrow: string; title: string; subtitle?: string }
  | {
      type: "product";
      name: string;
      meta?: string;
      imageUrl?: string;
      qty?: number;
    }
  | { type: "card"; title: string; rows: Array<{ label: string; value: string }> }
  | { type: "steps"; steps: Array<{ label: string; done: boolean }> }
  | {
      type: "summary";
      lines: Array<{ label: string; value: string }>;
      total?: { label: string; value: string };
    }
  | { type: "checklist"; title: string; items: string[] }
  | { type: "text"; body: string }
  | { type: "address"; title: string; lines: string[] }
  | {
      type: "cta";
      label: string;
      href: string;
      secondary?: Array<{ label: string; href: string }>;
    };

function renderSection(section: Section): string {
  const { gold, ink, mute, faint, ivory, line, paper } = EMAIL;

  switch (section.type) {
    case "hero":
      return `<tr><td style="padding:32px 40px 8px;">
        <p style="margin:0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${gold};font-weight:600;">${escapeHtml(section.eyebrow)}</p>
        <h1 style="margin:12px 0 0;font-size:28px;line-height:1.15;font-weight:300;letter-spacing:-0.02em;color:${ink};">${escapeHtml(section.title)}</h1>
        ${section.subtitle ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:${mute};">${escapeHtml(section.subtitle)}</p>` : ""}
      </td></tr>`;

    case "product": {
      const img = section.imageUrl
        ? `<img src="${escapeHtml(section.imageUrl)}" alt="" width="72" height="72" style="display:block;border:0;border-radius:8px;object-fit:cover;width:72px;height:72px;background:${ivory};" />`
        : `<div style="width:72px;height:72px;background:${ivory};border:1px solid ${line};border-radius:8px;"></div>`;
      return `<tr><td style="padding:20px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};background:${ivory};">
          <tr>
            <td style="padding:16px;width:72px;vertical-align:top;">${img}</td>
            <td style="padding:16px 16px 16px 0;vertical-align:middle;">
              <p style="margin:0;font-size:17px;font-weight:500;color:${ink};">${escapeHtml(section.name)}</p>
              ${section.meta ? `<p style="margin:6px 0 0;font-size:13px;color:${mute};">${escapeHtml(section.meta)}</p>` : ""}
              ${typeof section.qty === "number" ? `<p style="margin:8px 0 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${faint};">Qty ${section.qty}</p>` : ""}
            </td>
          </tr>
        </table>
      </td></tr>`;
    }

    case "card":
      return `<tr><td style="padding:8px 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};">
          <tr><td style="padding:16px 18px 8px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${faint};">${escapeHtml(section.title)}</td></tr>
          ${section.rows
            .map(
              (r) => `<tr>
                <td style="padding:6px 18px;font-size:12px;color:${faint};text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(r.label)}</td>
              </tr>
              <tr>
                <td style="padding:0 18px 12px;font-size:15px;color:${ink};font-weight:500;">${escapeHtml(r.value)}</td>
              </tr>`
            )
            .join("")}
        </table>
      </td></tr>`;

    case "steps":
      return `<tr><td style="padding:8px 40px 20px;">
        <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${faint};">Status</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${section.steps
              .map((s, i) => {
                const mark = s.done ? "✓" : "○";
                const color = s.done ? ink : faint;
                return `<td align="center" style="padding:4px;font-size:11px;color:${color};">
                  <div style="font-size:14px;margin-bottom:6px;">${mark}</div>
                  ${escapeHtml(s.label)}${i < section.steps.length - 1 ? "" : ""}
                </td>`;
              })
              .join("")}
          </tr>
        </table>
      </td></tr>`;

    case "summary":
      return `<tr><td style="padding:8px 40px 20px;">
        <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${faint};">Order summary</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${section.lines
            .map(
              (l) => `<tr>
                <td style="padding:6px 0;font-size:14px;color:${mute};">${escapeHtml(l.label)}</td>
                <td align="right" style="padding:6px 0;font-size:14px;color:${ink};">${escapeHtml(l.value)}</td>
              </tr>`
            )
            .join("")}
          ${
            section.total
              ? `<tr>
                  <td style="padding:14px 0 0;border-top:1px solid ${line};font-size:15px;font-weight:500;color:${ink};">${escapeHtml(section.total.label)}</td>
                  <td align="right" style="padding:14px 0 0;border-top:1px solid ${line};font-size:15px;font-weight:500;color:${ink};">${escapeHtml(section.total.value)}</td>
                </tr>`
              : ""
          }
        </table>
      </td></tr>`;

    case "checklist":
      return `<tr><td style="padding:8px 40px 24px;">
        <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${gold};">${escapeHtml(section.title)}</p>
        <p style="margin:0;font-size:13px;line-height:1.7;color:${mute};">
          ${section.items.map((i) => `✓ ${escapeHtml(i)}`).join("<br />")}
        </p>
      </td></tr>`;

    case "text":
      return `<tr><td style="padding:8px 40px 16px;font-size:14px;line-height:1.65;color:${mute};">${escapeHtml(section.body).replace(/\n/g, "<br />")}</td></tr>`;

    case "address":
      return `<tr><td style="padding:8px 40px 20px;">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${faint};">${escapeHtml(section.title)}</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:${ink};">${section.lines.map(escapeHtml).join("<br />")}</p>
      </td></tr>`;

    case "cta":
      return `<tr><td align="center" style="padding:8px 40px 28px;">
        <a href="${escapeHtml(section.href)}" style="display:inline-block;background:${ink};color:${paper};text-decoration:none;font-size:14px;font-weight:500;padding:14px 28px;border-radius:999px;">${escapeHtml(section.label)}</a>
        ${
          section.secondary?.length
            ? `<p style="margin:16px 0 0;font-size:12px;color:${mute};">${section.secondary
                .map(
                  (s) =>
                    `<a href="${escapeHtml(s.href)}" style="color:${ink};text-decoration:underline;">${escapeHtml(s.label)}</a>`
                )
                .join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</p>`
            : ""
        }
      </td></tr>`;

    default:
      return "";
  }
}

/**
 * Shared Cashmir Biotech email chrome — logo, gold rule, footer.
 * Use for all non-OTP transactional mail.
 */
export function buildBrandedMail(input: {
  fromDisplay: string;
  subject: string;
  preheader?: string;
  sections: Section[];
  legalNote?: string;
}): BuiltMail {
  const { gold, ink, mute, faint, ivory, paper, line } = EMAIL;
  const base = emailSiteUrl();
  const support = emailSupport();
  const logoUrl = `${base}/logo.png`;

  const textParts: string[] = ["CASHMIR BIOTECH", "", input.subject, ""];
  for (const s of input.sections) {
    if (s.type === "hero") {
      textParts.push(s.eyebrow.toUpperCase(), s.title, s.subtitle ?? "", "");
    } else if (s.type === "product") {
      textParts.push(s.name, s.meta ?? "", typeof s.qty === "number" ? `Qty ${s.qty}` : "", "");
    } else if (s.type === "card") {
      textParts.push(s.title, ...s.rows.map((r) => `${r.label}: ${r.value}`), "");
    } else if (s.type === "steps") {
      textParts.push("Status", ...s.steps.map((st) => `${st.done ? "✓" : "○"} ${st.label}`), "");
    } else if (s.type === "summary") {
      textParts.push("Order summary", ...s.lines.map((l) => `${l.label}: ${l.value}`));
      if (s.total) textParts.push(`${s.total.label}: ${s.total.value}`);
      textParts.push("");
    } else if (s.type === "checklist") {
      textParts.push(s.title, ...s.items.map((i) => `✓ ${i}`), "");
    } else if (s.type === "text") {
      textParts.push(s.body, "");
    } else if (s.type === "address") {
      textParts.push(s.title, ...s.lines, "");
    } else if (s.type === "cta") {
      textParts.push(`${s.label}: ${s.href}`, ...(s.secondary?.map((x) => `${x.label}: ${x.href}`) ?? []), "");
    }
  }
  textParts.push(
    "Need help?",
    support,
    base,
    "",
    "Cashmir Biotech",
    "Patent-backed biological formulations",
    `© ${new Date().getFullYear()} ${SITE_CONTACT.company} · ${SITE_CONTACT.location}`
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${ivory};color:${ink};font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  ${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ivory};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${paper};border:1px solid ${line};">
        <tr><td style="height:3px;background:${gold};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 40px 0;">
          <img src="${escapeHtml(logoUrl)}" alt="Cashmir Biotech" width="140" style="display:block;border:0;max-width:140px;height:auto;" />
        </td></tr>
        ${input.sections.map(renderSection).join("\n")}
        <tr><td style="padding:20px 40px 28px;background:${ivory};border-top:1px solid ${line};">
          ${input.legalNote ? `<p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:${faint};">${escapeHtml(input.legalNote)}</p>` : ""}
          <p style="margin:0;font-size:12px;color:${mute};">Need help? <a href="mailto:${escapeHtml(support)}" style="color:${ink};">${escapeHtml(support)}</a></p>
          <p style="margin:10px 0 0;font-size:12px;">
            <a href="${escapeHtml(base)}" style="color:${mute};text-decoration:none;">Website</a>
            &nbsp;·&nbsp;
            <a href="${escapeHtml(base)}/portal/login" style="color:${mute};text-decoration:none;">Customer Portal</a>
            &nbsp;·&nbsp;
            <a href="${escapeHtml(base)}/contact" style="color:${mute};text-decoration:none;">Support</a>
          </p>
          <p style="margin:18px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${gold};">Cashmir Biotech</p>
          <p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:${faint};">
            Patent-backed biological formulations<br />
            © ${new Date().getFullYear()} ${escapeHtml(SITE_CONTACT.company)} · ${escapeHtml(SITE_CONTACT.location)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: input.subject,
    text: textParts.filter((l) => l !== undefined).join("\n"),
    html,
    fromDisplay: input.fromDisplay
  };
}

export type { Section };
