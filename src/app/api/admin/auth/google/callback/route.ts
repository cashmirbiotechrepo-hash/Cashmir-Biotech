import { NextResponse } from "next/server";
import { validateOAuthState } from "@/lib/oauth-state";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createAdminSessionFromOAuth } from "@/lib/customer/oauth-session";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_REFRESH_COOKIE
} from "@/config/auth.constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleTokenResponse = {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown";

  if (errorParam) {
    logger.warn({ event: "admin_google_oauth_denied", error: errorParam, ip }, "Admin Google OAuth denied");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_denied", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_missing_code", request.url));
  }

  // Validate state cookie — CSRF guard
  const statePayload = await validateOAuthState(stateParam, "admin");
  if (!statePayload) {
    logger.warn({ event: "admin_google_state_mismatch", ip }, "Admin Google OAuth state mismatch");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_state_mismatch", request.url));
  }

  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.ADMIN_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_not_configured", request.url));
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = `${siteUrl}/api/admin/auth/google/callback`;

  // Exchange authorization code for tokens
  let tokens: GoogleTokenResponse;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
        code_verifier: statePayload.codeVerifier
      }).toString()
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ event: "admin_google_token_failed", status: res.status, body, ip }, "Admin token exchange failed");
      return NextResponse.redirect(new URL("/admin/login?error=oauth_token_failed", request.url));
    }
    tokens = (await res.json()) as GoogleTokenResponse;
  } catch (err) {
    logger.error({ err, event: "admin_google_token_error", ip }, "Admin token exchange threw");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_token_failed", request.url));
  }

  // Fetch user info from Google
  let userInfo: GoogleUserInfo;
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!res.ok) {
      return NextResponse.redirect(new URL("/admin/login?error=oauth_userinfo_failed", request.url));
    }
    userInfo = (await res.json()) as GoogleUserInfo;
  } catch (err) {
    logger.error({ err, event: "admin_google_userinfo_error", ip }, "Admin userinfo fetch threw");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_userinfo_failed", request.url));
  }

  if (!userInfo.email_verified) {
    logger.warn({ event: "admin_google_unverified_email", ip }, "Admin Google returned unverified email");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_unverified_email", request.url));
  }

  const email = userInfo.email.toLowerCase().trim();
  const providerAccountId = userInfo.sub;

  // ── Admin lookup — NO AUTO-PROVISION ──────────────────────────────────────
  //
  // If the verified email has no matching AdminUser → log the attempt and reject.
  // We never create an AdminUser from an OAuth callback.
  //
  let adminId: string;

  try {
    // 1. Check if this Google account is already linked
    const existingAccount = await db.adminAccount.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId } },
      select: { adminId: true }
    });

    if (existingAccount) {
      // Known admin OAuth user — verify still active
      const admin = await db.adminUser.findUnique({
        where: { id: existingAccount.adminId },
        select: { id: true, active: true }
      });
      if (!admin || !admin.active) {
        logger.warn({ event: "admin_google_deactivated", email, ip }, "Deactivated admin attempted Google OAuth");
        return NextResponse.redirect(new URL("/admin/login?error=account_inactive", request.url));
      }
      adminId = existingAccount.adminId;
    } else {
      // Unknown account — look up by email
      const admin = await db.adminUser.findUnique({
        where: { email },
        select: { id: true, active: true }
      });

      if (!admin) {
        // CRITICAL: no admin found — log and reject, never create
        logger.warn(
          { event: "admin_google_no_account", email, providerAccountId, ip },
          "Google OAuth attempt from email with no AdminUser — rejected (not auto-provisioned)"
        );
        return NextResponse.redirect(new URL("/admin/login?error=no_admin_account", request.url));
      }

      if (!admin.active) {
        logger.warn({ event: "admin_google_deactivated", email, ip }, "Deactivated admin attempted Google OAuth");
        return NextResponse.redirect(new URL("/admin/login?error=account_inactive", request.url));
      }

      // Link this Google account to the existing AdminUser
      await db.adminAccount.create({
        data: { adminId: admin.id, provider: "google", providerAccountId }
      });
      logger.info({ event: "admin_google_linked", adminId: admin.id, email }, "Google account linked to existing admin");
      adminId = admin.id;
    }
  } catch (err) {
    logger.error({ err, event: "admin_google_db_error", email, ip }, "DB error during admin Google OAuth");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_server_error", request.url));
  }

  // Issue admin session + cookies
  try {
    const { accessToken, refreshToken } = await createAdminSessionFromOAuth(adminId, request);
    const isProd = process.env.NODE_ENV === "production";
    const jar = await cookies();
    jar.set(ADMIN_SESSION_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60
    });
    jar.set(ADMIN_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60
    });
  } catch (err) {
    logger.error({ err, event: "admin_google_session_error", adminId, ip }, "Failed to create admin session");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_server_error", request.url));
  }

  const dest =
    statePayload.redirectTo.startsWith("/admin") &&
    !statePayload.redirectTo.startsWith("//") &&
    !statePayload.redirectTo.includes("\\")
      ? statePayload.redirectTo
      : "/admin/dashboard";

  return NextResponse.redirect(new URL(dest, request.url));
}
