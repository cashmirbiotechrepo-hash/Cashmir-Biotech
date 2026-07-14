import { Ratelimit } from "@upstash/ratelimit";
/** Cloudflare/Edge build — avoids Node-only `process.version` in default `@upstash/redis` entry. */
import { Redis } from "@upstash/redis/cloudflare";

/* ---------------------------------------------------------------------------
 * CRIT-04 FIX: Rate limiting is now MANDATORY in production.
 *
 * - If Upstash Redis is configured → use Upstash sliding window (distributed).
 * - If NOT configured in development → fall back to in-memory sliding window.
 * - If NOT configured in production → throw immediately at startup.
 *
 * Code Refactoring #1: All 5 duplicate factory functions collapsed into one.
 * --------------------------------------------------------------------------- */

type RateLimitConfig = {
  prefix: string;
  limit: number;
  window: string;
};

const singletons = new Map<string, Ratelimit>();

/* ── In-Memory Sliding Window (Dev Fallback) ───────────────────────────────── */

class InMemoryStore {
  private windows = new Map<string, number[]>();

  hit(key: string, maxHits: number, windowMs: number): { success: boolean; remaining: number } {
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (this.windows.get(key) ?? []).filter((t) => t > cutoff);
    hits.push(now);
    this.windows.set(key, hits);

    // Periodic cleanup of stale keys
    if (this.windows.size > 10_000) {
      for (const [k, v] of this.windows) {
        if (v.every((t) => t < cutoff)) this.windows.delete(k);
      }
    }

    return {
      success: hits.length <= maxHits,
      remaining: Math.max(0, maxHits - hits.length)
    };
  }
}

const inMemoryStore = new InMemoryStore();

function parseWindowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*([smhd])$/);
  if (!match) return 60_000;
  const value = parseInt(match[1]!, 10);
  switch (match[2]) {
    case "s": return value * 1_000;
    case "m": return value * 60_000;
    case "h": return value * 3_600_000;
    case "d": return value * 86_400_000;
    default: return 60_000;
  }
}

/**
 * In-memory rate limiter that matches the Upstash Ratelimit interface.
 * Only used as a development fallback — NOT suitable for multi-instance production.
 */
class InMemoryRatelimit {
  constructor(
    private prefix: string,
    private maxHits: number,
    private windowMs: number
  ) {}

  async limit(key: string) {
    const { success, remaining } = inMemoryStore.hit(
      `${this.prefix}:${key}`,
      this.maxHits,
      this.windowMs
    );
    return {
      success,
      remaining,
      limit: this.maxHits,
      reset: Date.now() + this.windowMs,
      pending: Promise.resolve()
    };
  }
}

/* ── Factory ──────────────────────────────────────────────────────────────── */

function createRateLimiter(config: RateLimitConfig): Ratelimit {
  const existing = singletons.get(config.prefix);
  if (existing) return existing;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  let limiter: Ratelimit;

  if (url && token) {
    const redis = new Redis({ url, token });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window as `${number} ${"s" | "ms" | "m" | "h" | "d"}`),
      prefix: `cashmir:${config.prefix}`,
      analytics: true
    });
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      `UPSTASH_REDIS_REST_URL/TOKEN are required in production for rate limiting (${config.prefix}). ` +
      `Set these environment variables before deploying.`
    );
  } else {
    // Development in-memory fallback
    console.warn(
      `[rate-limit] Upstash Redis not configured — using in-memory fallback for "${config.prefix}". ` +
      `This is NOT safe for production.`
    );
    limiter = new InMemoryRatelimit(
      `cashmir:${config.prefix}`,
      config.limit,
      parseWindowToMs(config.window)
    ) as unknown as Ratelimit;
  }

  singletons.set(config.prefix, limiter);
  return limiter;
}

/* ── Public API (unchanged signatures) ────────────────────────────────────── */

/** Edge-safe admin login rate limiter — 15 per minute per IP. */
export function getAdminLoginRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "admin_login", limit: 15, window: "1 m" });
}

/** Rate limiter for POST /api/newsletter — 5 per minute per IP. */
export function getNewsletterRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "newsletter", limit: 5, window: "1 m" });
}

/** Rate limit image uploads — 30 per minute per IP. */
export function getAdminUploadRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "admin_upload", limit: 30, window: "1 m" });
}

/** Rate limit checkout/order creation — 10 per minute per IP to stop bot order spam. */
export function getCheckoutRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "checkout", limit: 10, window: "1 m" });
}

/** Rate limit portal OTP request/verify — 10 per minute per IP. */
export function getPortalOtpRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "portal_otp", limit: 10, window: "1 m" });
}

/** Rate limit webhook ingress — 100 per minute per IP. (HIGH-13) */
export function getWebhookRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "webhook", limit: 100, window: "1 m" });
}

/** Rate limit bioinformatics tools — CPU-heavy; 20/min per IP. */
export function getToolsRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "tools", limit: 20, window: "1 m" });
}

/** Guest order lookup OTP — 8/min per IP (email bombing prevention). */
export function getOrderLookupRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "order_lookup", limit: 8, window: "1 m" });
}

/** Payment verify — 30/min per IP. */
export function getPaymentVerifyRatelimit(): Ratelimit {
  return createRateLimiter({ prefix: "payment_verify", limit: 30, window: "1 m" });
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
