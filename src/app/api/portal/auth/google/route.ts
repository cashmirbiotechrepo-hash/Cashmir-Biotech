import { NextRequest, NextResponse } from "next/server";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  setOAuthStateCookie
} from "@/lib/oauth-state";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    logger.error({ event: "google_oauth_not_configured" }, "GOOGLE_CLIENT_ID is not set");
    const url = request.nextUrl.clone();
    url.pathname = "/portal/login";
    url.searchParams.set("error", "oauth_not_configured");
    return NextResponse.redirect(url);
  }

  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/portal";
  // Sanitise: only allow relative portal paths
  const redirectTo =
    next.startsWith("/portal") && !next.startsWith("//") && !next.includes("\\") ? next : "/portal";

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  await setOAuthStateCookie({ state, codeVerifier, provider: "google", redirectTo }, "customer");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = new URL("/api/portal/auth/google/callback", siteUrl).toString();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authUrl.toString());
}
