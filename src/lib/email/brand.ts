import "server-only";
import { SITE_CONTACT } from "@/lib/site-contact";

/** Restrained transactional palette — one accent (ink), muted captions only. */
export const EMAIL = {
  ink: "#18181b",
  body: "#3f3f46",
  mute: "#71717a",
  line: "#e4e4e7",
  canvas: "#f4f4f5",
  paper: "#ffffff",
  /** Single brand accent — used once (top rule), not throughout copy */
  accent: "#b89458"
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

export type Section =
  | { type: "hero"; title: string; subtitle?: string }
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
  const { ink, body, mute, line, canvas, paper } = EMAIL;

  switch (section.type) {
    case "hero":
      return `<tr><td style="padding:20px 28px 4px;">
        <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${ink};">${escapeHtml(section.title)}</h1>
        ${section.subtitle ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.5;color:${body};">${escapeHtml(section.subtitle)}</p>` : ""}
      </td></tr>`;

    case "product": {
      const img = section.imageUrl
        ? `<img src="${escapeHtml(section.imageUrl)}" alt="" width="56" height="56" style="display:block;border:0;border-radius:6px;object-fit:cover;width:56px;height:56px;background:${canvas};" />`
        : "";
      return `<tr><td style="padding:12px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${img ? `<td style="width:56px;padding-right:14px;vertical-align:top;">${img}</td>` : ""}
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:15px;font-weight:600;color:${ink};">${escapeHtml(section.name)}</p>
              ${section.meta ? `<p style="margin:4px 0 0;font-size:13px;color:${body};">${escapeHtml(section.meta)}</p>` : ""}
              ${typeof section.qty === "number" ? `<p style="margin:4px 0 0;font-size:13px;color:${mute};">Qty ${section.qty}</p>` : ""}
            </td>
          </tr>
        </table>
      </td></tr>`;
    }

    case "card":
      return `<tr><td style="padding:12px 28px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${ink};">${escapeHtml(section.title)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${section.rows
            .map(
              (r) => `<tr>
                <td style="padding:4px 0;font-size:13px;color:${mute};width:40%;">${escapeHtml(r.label)}</td>
                <td style="padding:4px 0;font-size:13px;color:${ink};font-weight:500;">${escapeHtml(r.value)}</td>
              </tr>`
            )
            .join("")}
        </table>
      </td></tr>`;

    case "steps": {
      // Single active stage callout — clearer than a cramped 5-column timeline
      const current = [...section.steps].reverse().find((s) => s.done) ?? section.steps[0];
      const labels = section.steps.map((s) => (s.done ? s.label : s.label)).join(" → ");
      return `<tr><td style="padding:12px 28px;">
        <p style="margin:0;font-size:13px;color:${mute};">Status</p>
        <p style="margin:6px 0 0;font-size:16px;font-weight:600;color:${ink};">${escapeHtml(current?.label ?? "")}</p>
        <p style="margin:6px 0 0;font-size:12px;line-height:1.45;color:${mute};">${escapeHtml(labels)}</p>
      </td></tr>`;
    }

    case "summary":
      return `<tr><td style="padding:12px 28px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${ink};">Order summary</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${section.lines
            .map(
              (l) => `<tr>
                <td style="padding:4px 0;font-size:13px;color:${body};">${escapeHtml(l.label)}</td>
                <td align="right" style="padding:4px 0;font-size:13px;color:${ink};">${escapeHtml(l.value)}</td>
              </tr>`
            )
            .join("")}
          ${
            section.total
              ? `<tr>
                  <td style="padding:10px 0 0;border-top:1px solid ${line};font-size:14px;font-weight:600;color:${ink};">${escapeHtml(section.total.label)}</td>
                  <td align="right" style="padding:10px 0 0;border-top:1px solid ${line};font-size:14px;font-weight:600;color:${ink};">${escapeHtml(section.total.value)}</td>
                </tr>`
              : ""
          }
        </table>
      </td></tr>`;

    case "checklist":
      return `<tr><td style="padding:8px 28px 12px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${ink};">${escapeHtml(section.title)}</p>
        <p style="margin:0;font-size:13px;line-height:1.55;color:${body};">
          ${section.items.map((i) => `· ${escapeHtml(i)}`).join("<br />")}
        </p>
      </td></tr>`;

    case "text":
      return `<tr><td style="padding:8px 28px;font-size:14px;line-height:1.55;color:${body};">${escapeHtml(section.body).replace(/\n/g, "<br />")}</td></tr>`;

    case "address":
      return `<tr><td style="padding:12px 28px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${ink};">${escapeHtml(section.title)}</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:${body};">${section.lines.map(escapeHtml).join("<br />")}</p>
      </td></tr>`;

    case "cta":
      return `<tr><td style="padding:16px 28px 8px;">
        <a href="${escapeHtml(section.href)}" style="display:inline-block;background:${ink};color:${paper};text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(section.label)}</a>
        ${
          section.secondary?.length
            ? `<p style="margin:12px 0 0;font-size:13px;color:${mute};">${section.secondary
                .map(
                  (s) =>
                    `<a href="${escapeHtml(s.href)}" style="color:${ink};text-decoration:underline;">${escapeHtml(s.label)}</a>`
                )
                .join(" · ")}</p>`
            : ""
        }
      </td></tr>`;

    default:
      return "";
  }
}

/** Compact shared chrome: small logo, content, one help line, minimal footer. */
export function buildBrandedMail(input: {
  fromDisplay: string;
  subject: string;
  preheader?: string;
  sections: Section[];
  legalNote?: string;
}): BuiltMail {
  const { ink, body, mute, canvas, paper, line, accent } = EMAIL;
  const base = emailSiteUrl();
  const support = emailSupport();
  const logoUrl = `${base}/logo.png`;

  const textParts: string[] = ["Cashmir Biotech", "", input.subject, ""];
  for (const s of input.sections) {
    if (s.type === "hero") {
      textParts.push(s.title, s.subtitle ?? "", "");
    } else if (s.type === "product") {
      textParts.push(s.name, s.meta ?? "", typeof s.qty === "number" ? `Qty ${s.qty}` : "", "");
    } else if (s.type === "card") {
      textParts.push(s.title, ...s.rows.map((r) => `${r.label}: ${r.value}`), "");
    } else if (s.type === "steps") {
      const current = [...s.steps].reverse().find((st) => st.done);
      textParts.push(`Status: ${current?.label ?? ""}`, "");
    } else if (s.type === "summary") {
      textParts.push("Order summary", ...s.lines.map((l) => `${l.label}: ${l.value}`));
      if (s.total) textParts.push(`${s.total.label}: ${s.total.value}`);
      textParts.push("");
    } else if (s.type === "checklist") {
      textParts.push(s.title, ...s.items.map((i) => `· ${i}`), "");
    } else if (s.type === "text") {
      textParts.push(s.body, "");
    } else if (s.type === "address") {
      textParts.push(s.title, ...s.lines, "");
    } else if (s.type === "cta") {
      textParts.push(`${s.label}: ${s.href}`, ...(s.secondary?.map((x) => `${x.label}: ${x.href}`) ?? []), "");
    }
  }
  textParts.push("Need help?", support, "", `© ${new Date().getFullYear()} ${SITE_CONTACT.company}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${canvas};color:${ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${canvas};padding:16px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${paper};border:1px solid ${line};">
        <tr><td style="height:2px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:16px 28px 0;">
          <img src="${escapeHtml(logoUrl)}" alt="Cashmir Biotech" width="48" height="39" style="display:block;border:0;width:48px;height:auto;" />
          <p style="margin:8px 0 0;font-size:13px;font-weight:600;color:${ink};">Cashmir Biotech</p>
        </td></tr>
        ${input.sections.map(renderSection).join("\n")}
        <tr><td style="padding:20px 28px 24px;">
          <p style="margin:0;font-size:13px;color:${body};">Need help? <a href="mailto:${escapeHtml(support)}" style="color:${ink};">${escapeHtml(support)}</a></p>
          ${input.legalNote ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.45;color:${mute};">${escapeHtml(input.legalNote)}</p>` : ""}
          <p style="margin:14px 0 0;font-size:12px;color:${mute};">
            <a href="${escapeHtml(base)}" style="color:${mute};text-decoration:underline;">cashmirbiotech.com</a>
            · © ${new Date().getFullYear()} ${escapeHtml(SITE_CONTACT.company)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: input.subject,
    text: textParts.filter((l) => l !== undefined && l !== "").join("\n"),
    html,
    fromDisplay: input.fromDisplay
  };
}
