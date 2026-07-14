/**
 * Quick SMTP smoke test for Cashmir Biotech.
 *
 * Usage:
 *   npx --env-file=.env tsx scripts/test-smtp.ts
 *   npx --env-file=.env tsx scripts/test-smtp.ts you@example.com
 */
async function main() {
  const to = process.argv[2] || process.env.SMTP_USER;
  if (!to) {
    console.error("Set SMTP_USER in .env or pass a recipient.");
    process.exit(1);
  }

  const { sendAdminMail, isSmtpConfigured } = await import("../src/lib/admin/mail");

  if (!isSmtpConfigured()) {
    console.error("SMTP is not configured. Check SMTP_HOST / SMTP_USER / SMTP_PASS in .env");
    process.exit(1);
  }

  console.log(`Sending test email to ${to} via ${process.env.SMTP_HOST}…`);
  const ok = await sendAdminMail({
    to,
    subject: "Cashmir Biotech — SMTP test",
    text: [
      "This is a test message from the Cashmir Biotech platform.",
      "",
      `SMTP user: ${process.env.SMTP_USER}`,
      `Sent at: ${new Date().toISOString()}`,
      "",
      "If you received this, Gmail SMTP is working."
    ].join("\n")
  });

  if (!ok) {
    console.error("Send failed. Check App Password, 2FA on the Google account, and server logs.");
    process.exit(1);
  }

  console.log("Sent successfully. Check the inbox (and Spam).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
