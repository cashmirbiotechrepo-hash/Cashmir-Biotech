/**
 * Edge-safe session revoke denylist.
 * When Upstash is configured, revoked sessions are rejected in middleware immediately.
 * Without Upstash, access tokens are short-lived (15m) so revoke is near-real-time after expiry.
 */
import { Redis } from "@upstash/redis/cloudflare";

const PREFIX = "cb:revoked:session:";
const memory = new Map<string, number>();

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function markSessionRevokedEdge(sessionId: string, ttlSeconds = 60 * 60 * 24 * 31) {
  const key = `${PREFIX}${sessionId}`;
  memory.set(key, Date.now() + ttlSeconds * 1000);
  const r = redis();
  if (r) {
    await r.set(key, "1", { ex: ttlSeconds }).catch(() => undefined);
  }
}

export async function isSessionRevokedEdge(sessionId: string): Promise<boolean> {
  const key = `${PREFIX}${sessionId}`;
  const local = memory.get(key);
  if (local && local > Date.now()) return true;
  if (local && local <= Date.now()) memory.delete(key);

  const r = redis();
  if (!r) {
    // No distributed denylist — access JWTs are short-lived (15m); DB session checks cover Node routes.
    return false;
  }
  try {
    const v = await r.get(key);
    return Boolean(v);
  } catch {
    // S-01 FIX: Fail closed in production — if we cannot verify the denylist,
    // treat the session as revoked. This prevents a Redis outage from bypassing
    // session revocation for deactivated/logged-out users.
    if (process.env.NODE_ENV === "production") {
      return true;
    }
    return false;
  }
}
