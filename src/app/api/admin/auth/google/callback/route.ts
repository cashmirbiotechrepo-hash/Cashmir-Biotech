import { NextResponse } from "next/server";
import { validateOAuthState } from "@/lib/oauth-state";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createAdminSessionFromOAuth } from "@/lib/admin/oauth-session";
import { ADMIN_SESSION_COOKIE, ADMIN_REFRESH_COOKIE } from "@/config/auth.constants";

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
    return NextResponse.redirect(new URL("/admin/login?error=oauth_denied", siteUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_missing_code", siteUrl));
  }

  // Validate state cookie — CSRF guard
  const statePayload = await validateOAuthState(stateParam, "admin");
  if (!statePayload) {
    logger.warn({ event: "admin_google_state_mismatch", ip }, "Admin Google OAuth state mismatch");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_state_mismatch", siteUrl));
  }

  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.ADMIN_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_not_configured", siteUrl));
  }

  const callbackUrl = new URL("/api/admin/auth/google/callback", siteUrl).toString();

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
      return NextResponse.redirect(new URL("/admin/login?error=oauth_token_failed", siteUrl));
    }
    tokens = (await res.json()) as GoogleTokenResponse;
  } catch (err) {
    logger.error({ err, event: "admin_google_token_error", ip }, "Admin token exchange threw");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_token_failed", siteUrl));
  }

  // Fetch user info from Google
  let userInfo: GoogleUserInfo;
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!res.ok) {
      return NextResponse.redirect(new URL("/admin/login?error=oauth_userinfo_failed", siteUrl));
    }
    userInfo = (await res.json()) as GoogleUserInfo;
  } catch (err) {
    logger.error({ err, event: "admin_google_userinfo_error", ip }, "Admin userinfo fetch threw");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_userinfo_failed", siteUrl));
  }

  if (!userInfo.email_verified) {
    logger.warn({ event: "admin_google_unverified_email", ip }, "Admin Google returned unverified email");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_unverified_email", siteUrl));
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
        return NextResponse.redirect(new URL("/admin/login?error=account_inactive", siteUrl));
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
        return NextResponse.redirect(new URL("/admin/login?error=no_admin_account", siteUrl));
      }

      if (!admin.active) {
        logger.warn({ event: "admin_google_deactivated", email, ip }, "Deactivated admin attempted Google OAuth");
        return NextResponse.redirect(new URL("/admin/login?error=account_inactive", siteUrl));
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
    return NextResponse.redirect(new URL("/admin/login?error=oauth_server_error", siteUrl));
  }

  // Issue admin session + cookies
  // IMPORTANT: We set cookies directly on the redirect response because
  // cookies().set() in a Route Handler does NOT attach to NextResponse.redirect().
  const dest =
    statePayload.redirectTo.startsWith("/admin") &&
    !statePayload.redirectTo.startsWith("//") &&
    !statePayload.redirectTo.includes("\\")
      ? statePayload.redirectTo
      : "/admin/dashboard";

  let accessToken: string;
  let refreshToken: string;
  try {
    const session = await createAdminSessionFromOAuth(adminId, request);
    accessToken = session.accessToken;
    refreshToken = session.refreshToken;
  } catch (err) {
    logger.error({ err, event: "admin_google_session_error", adminId, ip }, "Failed to create admin session");
    return NextResponse.redirect(new URL("/admin/login?error=oauth_server_error", siteUrl));
  }

  // Encrypt the access token for the session cookie
  const { encryptToken } = await import("@/lib/admin/encryption");
  const encrypted = await encryptToken(accessToken);

  const isProduction = process.env.NODE_ENV === "production";
  const SESSION_COOKIE_MAX_AGE = 15 * 60;      // 15 minutes
  const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

  // WORKAROUND: AWS Amplify/CloudFront often strips Set-Cookie headers on 30x redirects.
  // Instead of a 307 redirect, we return a 200 OK HTML page that redirects via browser.
  const targetUrl = new URL(dest, siteUrl).toString();
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </head>
  <body><p>Redirecting to dashboard...</p></body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });

  // Set session cookie directly on the 200 OK response
  response.cookies.set(ADMIN_SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE
  });

  // Set refresh cookie directly on the 200 OK response
  response.cookies.set(ADMIN_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE
  });

  logger.info({ event: "admin_google_login_success", adminId }, "Admin signed in via Google OAuth");
  return response;
}
