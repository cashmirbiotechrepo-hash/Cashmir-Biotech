"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  clearAdminSessionCookies,
  setAdminSessionCookies
} from "@/lib/auth";
import { AdminAuthService, AccountLockedError, AdminAuthError } from "@/lib/admin/auth-service";
import { verifyPoW } from "@/lib/admin/pow";
import { loginSchema } from "@/modules/cms/validations/admin";
import { logger } from "@/lib/logger";
import { clientIpFromRequest } from "@/lib/rate-limit-edge";
import { db } from "@/lib/db";

export type LoginState = {
  error?: string;
  requireTwoFactor?: boolean;
  email?: string;
};

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/admin") ? value : "/admin/dashboard";
}

async function requestMeta() {
  const h = await headers();
  const ip = clientIpFromRequest({ headers: h } as Request);
  const userAgent = h.get("user-agent") ?? "";
  return { ip, userAgent };
}

export async function loginAction(formData: FormData): Promise<LoginState> {
  const twoFactorCode = String(formData.get("twoFactorCode") ?? "").trim() || undefined;
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const powChallenge = String(formData.get("powChallenge") ?? "");
  const powNonce = Number(formData.get("powNonce"));
  const powTimestamp = Number(formData.get("powTimestamp"));
  const powSignature = String(formData.get("powSignature") ?? "");
  const powDifficulty = Number(formData.get("powDifficulty") ?? 4);

  // Only skip PoW when a *server-issued* 2FA challenge is active for this email.
  // Never trust a client-supplied twoFactorCode alone — that would let attackers
  // opt out of PoW on accounts that do not even use 2FA.
  let skipPoW = false;
  if (twoFactorCode) {
    const challengeUser = await db.adminUser.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
      select: {
        isTwoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorExpires: true
      }
    });
    skipPoW = Boolean(
      challengeUser?.isTwoFactorEnabled &&
        challengeUser.twoFactorSecret &&
        challengeUser.twoFactorExpires &&
        challengeUser.twoFactorExpires.getTime() > Date.now()
    );
  }

  if (
    !skipPoW &&
    !verifyPoW({
      challenge: powChallenge,
      nonce: powNonce,
      timestamp: powTimestamp,
      signature: powSignature,
      difficulty: powDifficulty
    })
  ) {
    return { error: "Security verification failed. Please refresh and try again." };
  }

  const { ip, userAgent } = await requestMeta();

  try {
    const result = await AdminAuthService.login(
      parsed.data.email,
      parsed.data.password,
      ip,
      userAgent,
      twoFactorCode
    );

    if ("requireTwoFactor" in result) {
      return {
        requireTwoFactor: true,
        email: result.email
      };
    }

    await setAdminSessionCookies(result.accessToken, result.refreshToken);
    logger.info({ event: "admin_login_success", email: result.user.email }, "admin signed in");
    redirect(safeNext(formData.get("next")));
  } catch (err) {
    if (err instanceof AccountLockedError) {
      return { error: err.message };
    }
    if (err instanceof AdminAuthError) {
      logger.warn({ event: "admin_login_failed", code: err.code }, err.message);
      return { error: err.message };
    }
    if (err && typeof err === "object" && "digest" in err) throw err; // Next redirect
    logger.error({ err, event: "admin_login_error" }, "login failed");
    return { error: "Something went wrong. Please try again." };
  }
}

export async function resendTwoFactorAction(formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email) return { error: "Email is required." };

  const { generateAdminTwoFactorCode } = await import("@/lib/admin/two-factor");
  const result = await generateAdminTwoFactorCode(email);

  if (!result.ok) {
    if (result.reason === "cooldown") {
      return { error: "Please wait a minute before requesting another code.", requireTwoFactor: true, email };
    }
    return { error: "Could not send verification code. Check SMTP settings.", requireTwoFactor: true, email };
  }

  return { requireTwoFactor: true, email };
}
