import { Ratelimit } from "@upstash/ratelimit";
/** Cloudflare/Edge build — avoids Node-only `process.version` in default `@upstash/redis` entry. */
import { Redis } from "@upstash/redis/cloudflare";

/** Sliding window: generous enough for real admins; stops scripted brute force. */
const LOGIN_ATTEMPTS_PER_WINDOW = 15;
const WINDOW_DURATION = "1 m";

let ratelimitSingleton: Ratelimit | null | undefined;
let newsletterRatelimitSingleton: Ratelimit | null | undefined;
let adminUploadRatelimitSingleton: Ratelimit | null | undefined;
let checkoutRatelimitSingleton: Ratelimit | null | undefined;
let portalOtpRatelimitSingleton: Ratelimit | null | undefined;

/**
 * Edge-safe admin login rate limiter (Upstash Redis). Returns null if Redis env is not configured —
 * enable UPSTASH_* in production or rely on host/CDN rate limits.
 */
export function getAdminLoginRatelimit(): Ratelimit | null {
  if (ratelimitSingleton !== undefined) {
    return ratelimitSingleton;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    ratelimitSingleton = null;
    return null;
  }

  const redis = new Redis({ url, token });
  ratelimitSingleton = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(LOGIN_ATTEMPTS_PER_WINDOW, WINDOW_DURATION),
    prefix: "cashmir:admin_login",
    analytics: true
  });
  return ratelimitSingleton;
}

/**
 * Edge-safe rate limiter for POST /api/newsletter — stops scripted spam into the Subscriber table.
 * Returns null if Redis env is not configured.
 */
export function getNewsletterRatelimit(): Ratelimit | null {
  if (newsletterRatelimitSingleton !== undefined) {
    return newsletterRatelimitSingleton;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    newsletterRatelimitSingleton = null;
    return null;
  }

  const redis = new Redis({ url, token });
  newsletterRatelimitSingleton = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "cashmir:newsletter",
    analytics: true
  });
  return newsletterRatelimitSingleton;
}

/** Rate limit image uploads — 30 per minute per IP when Redis is configured. */
export function getAdminUploadRatelimit(): Ratelimit | null {
  if (adminUploadRatelimitSingleton !== undefined) {
    return adminUploadRatelimitSingleton;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    adminUploadRatelimitSingleton = null;
    return null;
  }

  const redis = new Redis({ url, token });
  adminUploadRatelimitSingleton = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "cashmir:admin_upload",
    analytics: true
  });
  return adminUploadRatelimitSingleton;
}

/** Rate limit checkout/order creation — 10 per minute per IP to stop bot order spam. */
export function getCheckoutRatelimit(): Ratelimit | null {
  if (checkoutRatelimitSingleton !== undefined) {
    return checkoutRatelimitSingleton;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    checkoutRatelimitSingleton = null;
    return null;
  }

  const redis = new Redis({ url, token });
  checkoutRatelimitSingleton = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "cashmir:checkout",
    analytics: true
  });
  return checkoutRatelimitSingleton;
}

/** Rate limit portal OTP request/verify — 10 per minute per IP when Redis is configured. */
export function getPortalOtpRatelimit(): Ratelimit | null {
  if (portalOtpRatelimitSingleton !== undefined) {
    return portalOtpRatelimitSingleton;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    portalOtpRatelimitSingleton = null;
    return null;
  }

  const redis = new Redis({ url, token });
  portalOtpRatelimitSingleton = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "cashmir:portal_otp",
    analytics: true
  });
  return portalOtpRatelimitSingleton;
}

/**
 * Resolve client IP for rate limiting.
 * Prefer platform-trusted headers (Cloudflare / proxies) over the leftmost
 * X-Forwarded-For hop, which clients can forge.
 */
export function clientIpFromRequest(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Prefer the right-most hop (typically appended by the edge) over the
    // client-controlled left-most value.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  return "unknown";
}
