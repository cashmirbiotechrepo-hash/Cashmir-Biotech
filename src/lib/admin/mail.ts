import "server-only";
import type { Transporter } from "nodemailer";
import { logger } from "@/lib/logger";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Overrides the display name / address in From (e.g. Cashmir Biotech Security <…>) */
  from?: string;
  replyTo?: string;
};

let cachedTransport: Transporter | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  // Gmail App Passwords are often pasted with spaces — strip them.
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  const port = Number(process.env.SMTP_PORT || "587");
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) return null;
  return { host, user, pass, port, from };
}

/**
 * Builds a From header like `Cashmir Biotech Security <user@gmail.com>`
 * while keeping the authenticated mailbox address.
 */
export function smtpFromWithDisplay(displayName: string): string | undefined {
  const config = getSmtpConfig();
  if (!config) return undefined;
  const angle = config.from.match(/<([^>]+)>/);
  const address = angle?.[1] || config.user;
  const safeName = displayName.replace(/[<>\r\n]/g, "").trim();
  return `${safeName} <${address}>`;
}

async function getTransport(): Promise<Transporter | null> {
  const config = getSmtpConfig();
  if (!config) return null;

  if (cachedTransport) return cachedTransport;

  const nodemailer = await import("nodemailer");
  const isGmail = config.host.includes("gmail.com");
  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    auth: { user: config.user, pass: config.pass },
    ...(isGmail
      ? {
          tls: {
            minVersion: "TLSv1.2" as const
          }
        }
      : {})
  });

  return cachedTransport;
}

/** Returns true when SMTP host/user/pass are configured. */
export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

/** Sends email via SMTP when configured. Returns false if SMTP is not set up or send fails. */
export async function sendAdminMail(input: SendMailInput): Promise<boolean> {
  const config = getSmtpConfig();
  if (!config) return false;

  try {
    const transport = await getTransport();
    if (!transport) return false;

    await transport.sendMail({
      from: input.from || config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo || process.env.SMTP_REPLY_TO || config.user
    });
    return true;
  } catch (err) {
    logger.error({ err, event: "admin_mail_failed", to: input.to }, "SMTP send failed");
    cachedTransport = null;
    return false;
  }
}

/** Sends a branded OTP email for any authentication kind. */
export async function sendOtpMail(input: {
  to: string;
  kind: import("@/lib/email/otp-email").OtpEmailKind;
  code: string;
  orderNumber?: string;
  requestedAt?: Date;
}): Promise<boolean> {
  const { buildOtpEmail } = await import("@/lib/email/otp-email");
  const built = buildOtpEmail({
    kind: input.kind,
    code: input.code,
    email: input.to,
    orderNumber: input.orderNumber,
    requestedAt: input.requestedAt
  });

  return sendAdminMail({
    to: input.to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    from: smtpFromWithDisplay(built.fromDisplay)
  });
}

/** Sends a pre-built branded transactional email (orders, refunds, invites — not OTP). */
export async function sendTransactionalMail(input: {
  to: string;
  mail: import("@/lib/email/brand").BuiltMail;
}): Promise<boolean> {
  return sendAdminMail({
    to: input.to,
    subject: input.mail.subject,
    text: input.mail.text,
    html: input.mail.html,
    from: smtpFromWithDisplay(input.mail.fromDisplay)
  });
}
