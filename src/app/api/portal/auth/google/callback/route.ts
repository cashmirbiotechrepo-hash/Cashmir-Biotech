import { NextResponse } from "next/server";
import { validateOAuthState } from "@/lib/oauth-state";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createCustomerSessionFromOAuth } from "@/lib/customer/oauth-session";
import { setCustomerSessionCookies } from "@/lib/customer/auth";

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
  sub: string;         // stable Google user ID
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // User denied consent or Google returned an error
  if (errorParam) {
    logger.warn({ event: "google_oauth_denied", error: errorParam }, "Google OAuth denied by user");
    return NextResponse.redirect(new URL("/portal/login?error=oauth_denied", siteUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/portal/login?error=oauth_missing_code", siteUrl));
  }

  // Validate state cookie — CSRF guard
  const statePayload = await validateOAuthState(stateParam, "customer");
  if (!statePayload) {
    logger.warn({ event: "google_oauth_state_mismatch" }, "Google OAuth state mismatch — possible CSRF");
    return NextResponse.redirect(new URL("/portal/login?error=oauth_state_mismatch", siteUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/portal/login?error=oauth_not_configured", siteUrl));
  }

  const callbackUrl = new URL("/api/portal/auth/google/callback", siteUrl).toString();

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
      logger.error({ event: "google_token_exchange_failed", status: res.status, body }, "Token exchange failed");
      return NextResponse.redirect(new URL("/portal/login?error=oauth_token_failed", siteUrl));
    }
    tokens = (await res.json()) as GoogleTokenResponse;
  } catch (err) {
    logger.error({ err, event: "google_token_exchange_error" }, "Token exchange threw");
    return NextResponse.redirect(new URL("/portal/login?error=oauth_token_failed", siteUrl));
  }

  // Fetch user info from Google
  let userInfo: GoogleUserInfo;
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!res.ok) {
      return NextResponse.redirect(new URL("/portal/login?error=oauth_userinfo_failed", siteUrl));
    }
    userInfo = (await res.json()) as GoogleUserInfo;
  } catch (err) {
    logger.error({ err, event: "google_userinfo_error" }, "userinfo fetch threw");
    return NextResponse.redirect(new URL("/portal/login?error=oauth_userinfo_failed", siteUrl));
  }

  // Google guarantees email_verified for @gmail.com and Workspace accounts, but be defensive
  if (!userInfo.email_verified) {
    logger.warn({ event: "google_unverified_email", sub: userInfo.sub }, "Google returned unverified email");
    return NextResponse.redirect(new URL("/portal/login?error=oauth_unverified_email", siteUrl));
  }

  const email = userInfo.email.toLowerCase().trim();
  const providerAccountId = userInfo.sub;
  const name = userInfo.name ?? userInfo.given_name ?? null;

  // ── Email-linking logic ────────────────────────────────────────────────────
  //
  // 1. If CustomerAccount exists → use its customerId (returning OAuth user)
  // 2. If no account but Customer exists with same email → link new account (OTP → Google merge)
  // 3. Neither → create new Customer + CustomerAccount (first sign-up via Google)
  //
  let customerId: string;

  try {
    const existingAccount = await db.customerAccount.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId } }
    });

    if (existingAccount) {
      // Returning Google user
      const customer = await db.customer.findUnique({
        where: { id: existingAccount.customerId },
        select: { id: true, active: true }
      });
      if (!customer || !customer.active) {
        logger.warn({ event: "google_oauth_inactive_customer", email }, "Inactive customer tried Google login");
        return NextResponse.redirect(new URL("/portal/login?error=account_inactive", siteUrl));
      }
      customerId = existingAccount.customerId;
    } else {
      // Look for an existing Customer by email
      const existingCustomer = await db.customer.findUnique({
        where: { email },
        select: { id: true, active: true }
      });

      if (existingCustomer) {
        if (!existingCustomer.active) {
          logger.warn({ event: "google_oauth_inactive_customer", email }, "Inactive customer tried Google login");
          return NextResponse.redirect(new URL("/portal/login?error=account_inactive", siteUrl));
        }
        // Link the Google account to the existing OTP-based customer
        customerId = existingCustomer.id;
        await db.customerAccount.create({
          data: { customerId, provider: "google", providerAccountId }
        });
        // Mark email as verified (Google guarantees it)
        await db.customer.update({
          where: { id: customerId },
          data: {
            emailVerifiedAt: new Date()
          }
        });
        logger.info({ event: "google_oauth_linked", customerId, email }, "Google account linked to existing customer");
      } else {
        // Brand-new customer — create both Customer and CustomerAccount
        const created = await db.customer.create({
          data: {
            email,
            name,
            emailVerifiedAt: new Date(), // Google guarantees verified
            accounts: {
              create: { provider: "google", providerAccountId }
            }
          }
        });
        customerId = created.id;
        logger.info({ event: "google_oauth_signup", customerId, email }, "New customer created via Google OAuth");
      }
    }
  } catch (err) {
    logger.error({ err, event: "google_oauth_db_error", email }, "DB error during Google OAuth linking");
    return NextResponse.redirect(new URL("/portal/login?error=oauth_server_error", siteUrl));
  }

  // Issue session + set cookies
  try {
    const { accessToken, refreshToken } = await createCustomerSessionFromOAuth(customerId, request);
    await setCustomerSessionCookies(accessToken, refreshToken);
  } catch (err) {
    logger.error({ err, event: "google_oauth_session_error", customerId }, "Failed to create session");
    return NextResponse.redirect(new URL("/portal/login?error=oauth_server_error", siteUrl));
  }

  const dest =
    statePayload.redirectTo.startsWith("/portal") &&
    !statePayload.redirectTo.startsWith("//") &&
    !statePayload.redirectTo.includes("\\")
      ? statePayload.redirectTo
      : "/portal";

  return NextResponse.redirect(new URL(dest, siteUrl));
}
