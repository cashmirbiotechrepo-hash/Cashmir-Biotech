import "server-only";
import { logger } from "@/lib/logger";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

/** Sends email via SMTP when configured. Returns false if SMTP is not set up or send fails. */
export async function sendAdminMail(input: SendMailInput): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || "587");
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) return false;

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text
    });
    return true;
  } catch (err) {
    logger.error({ err, event: "admin_mail_failed", to: input.to }, "SMTP send failed");
    return false;
  }
}
