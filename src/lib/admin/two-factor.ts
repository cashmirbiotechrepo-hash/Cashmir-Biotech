import "server-only";
import { createHash, randomInt } from "crypto";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendAdminMail } from "@/lib/admin/mail";
import { AdminPasswordService } from "@/lib/admin/password";

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export type TwoFactorSendResult =
  | { ok: true; reason: "sent" | "dev_mode" }
  | { ok: false; reason: "cooldown" | "user_not_found" | "email_failed" };

export async function generateAdminTwoFactorCode(email: string): Promise<TwoFactorSendResult> {
  const normalized = email.toLowerCase().trim();
  const user = await db.adminUser.findUnique({ where: { email: normalized } });
  if (!user) return { ok: false, reason: "user_not_found" };

  // Cooldown starts from when the last code was *issued* (expiresAt − CODE_EXPIRY),
  // not from the future expiry timestamp (which blocked resends for ~10 minutes).
  if (user.twoFactorExpires) {
    const issuedAt = user.twoFactorExpires.getTime() - CODE_EXPIRY_MS;
    if (issuedAt > Date.now() - COOLDOWN_MS) {
      return { ok: false, reason: "cooldown" };
    }
  }

  const code = String(randomInt(100000, 1000000));
  const hashed = hashCode(code);
  await db.adminUser.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: hashed,
      twoFactorExpires: new Date(Date.now() + CODE_EXPIRY_MS),
      twoFactorAttempts: 0
    }
  });

  const smtpReady =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (smtpReady) {
    const sent = await sendAdminMail({
      to: normalized,
      subject: "Cashmir Biotech — Admin sign-in code",
      text: `Your verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`
    });
    if (!sent) return { ok: false, reason: "email_failed" };
    return { ok: true, reason: "sent" };
  }

  if (process.env.NODE_ENV !== "production") {
    logger.info({ event: "admin_2fa_dev", code }, `[DEV] Admin 2FA code for ${normalized}`);
    return { ok: true, reason: "dev_mode" };
  }

  return { ok: false, reason: "email_failed" };
}

export async function verifyAdminTwoFactorCode(email: string, code: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!/^\d{6}$/.test(code)) return false;

  const user = await db.adminUser.findUnique({ where: { email: normalized } });
  if (!user?.twoFactorSecret || !user.twoFactorExpires) {
    AdminPasswordService.dummyVerify();
    return false;
  }

  if (user.twoFactorExpires.getTime() < Date.now()) return false;
  if (user.twoFactorAttempts >= MAX_ATTEMPTS) return false;

  const valid = (() => {
    const a = Buffer.from(hashCode(code));
    const b = Buffer.from(user.twoFactorSecret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  })();
  if (!valid) {
    await db.adminUser.update({
      where: { id: user.id },
      data: { twoFactorAttempts: { increment: 1 } }
    });
    return false;
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: null,
      twoFactorExpires: null,
      twoFactorAttempts: 0
    }
  });
  return true;
}
