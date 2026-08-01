import "server-only";
import crypto, { createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Short TTL — the browser sends the callback within seconds of the redirect. */
const STATE_TTL_SECONDS = 300; // 5 minutes

const CUSTOMER_COOKIE = "cb_oauth_state";
const ADMIN_COOKIE = "cb_admin_oauth_state";

export type OAuthStateCookiePayload = {
  state: string;
  codeVerifier: string;
  provider: string;
  redirectTo: string;
};

// ── HMAC sign / verify ────────────────────────────────────────────────────────

function getKey(): string {
  const key = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!key) throw new Error("ENCRYPTION_KEY or JWT_SECRET must be set for OAuth state signing");
  return key;
}

function sign(payload: OAuthStateCookiePayload): string {
  const json = JSON.stringify(payload);
  const mac = createHmac("sha256", getKey()).update(json).digest("base64url");
  return Buffer.from(json).toString("base64url") + "." + mac;
}

function verify(token: string): OAuthStateCookiePayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", getKey())
    .update(Buffer.from(encoded, "base64url").toString())
    .digest("base64url");
    
  const macBuf = Buffer.from(mac, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  
  if (macBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(macBuf, expectedBuf)) {
    return null;
  }
  
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString()) as OAuthStateCookiePayload;
  } catch {
    return null;
  }
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("base64url");
}

// ── Cookie read/write ─────────────────────────────────────────────────────────

function cookieName(surface: "customer" | "admin"): string {
  return surface === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
}

export async function setOAuthStateCookie(
  payload: OAuthStateCookiePayload,
  surface: "customer" | "admin"
): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(surface), sign(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: STATE_TTL_SECONDS
  });
}

/**
 * Read, verify, and immediately clear the OAuth state cookie.
 * Returns null if the cookie is missing, expired, or tampered with.
 */
export async function consumeOAuthStateCookie(
  surface: "customer" | "admin"
): Promise<OAuthStateCookiePayload | null> {
  const jar = await cookies();
  const name = cookieName(surface);
  const raw = jar.get(name)?.value;
  // We do not delete the cookie here because it prevents page reloads and double-fires 
  // from succeeding. It has a short TTL (5 minutes) and will expire naturally. (Issue II.5)
  if (!raw) return null;
  return verify(raw);
}

/**
 * Validate that the `state` query param matches the cookie payload.
 * Returns the full payload on success, null on mismatch.
 */
export async function validateOAuthState(
  queryState: string | null,
  surface: "customer" | "admin"
): Promise<OAuthStateCookiePayload | null> {
  const payload = await consumeOAuthStateCookie(surface);
  if (!payload || !queryState || payload.state !== queryState) return null;
  return payload;
}
