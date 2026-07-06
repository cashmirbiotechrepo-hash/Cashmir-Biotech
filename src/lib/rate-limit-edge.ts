import { Ratelimit } from "@upstash/ratelimit";
/** Cloudflare/Edge build — avoids Node-only `process.version` in default `@upstash/redis` entry. */
import { Redis } from "@upstash/redis/cloudflare";

/** Sliding window: generous enough for real admins; stops scripted brute force. */
const LOGIN_ATTEMPTS_PER_WINDOW = 15;
const WINDOW_DURATION = "1 m";

let ratelimitSingleton: Ratelimit | null | undefined;
let newsletterRatelimitSingleton: Ratelimit | null | undefined;

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

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
