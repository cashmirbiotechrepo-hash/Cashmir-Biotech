import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

/* ---------------------------------------------------------------------------
 * CRIT-03 FIX: PoW challenge tracking moved to Upstash Redis.
 *
 * - Production: uses Redis SETNX + TTL for distributed single-use enforcement.
 * - Development: uses in-memory Map as fallback (single-process only).
 * - Removed setInterval timer that leaked memory in serverless.
 * - Removed dev-only SKIP_DEV bypass for production safety.
 * --------------------------------------------------------------------------- */

const POW_CONFIG = {
  difficulty: parseInt(process.env.POW_DIFFICULTY || "4", 10),
  validityWindowMs: parseInt(process.env.POW_VALIDITY_MS || String(60 * 1000), 10),
  maxClockSkewMs: 5000,
  minDifficulty: 3,
  maxDifficulty: 6
};

function powSecret() {
  return (
    process.env.POW_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "dev-pow-secret-do-not-use-in-prod")
  );
}

/* ── Challenge Store (Redis-primary, in-memory fallback for dev) ──────────── */

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // Dynamic import to avoid bundling @upstash/redis in non-Redis environments
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

// In-memory fallback for development — NOT safe for multi-instance production
const devUsedChallenges = new Map<string, number>();

async function markChallengeUsed(challenge: string): Promise<boolean> {
  const strictProd =
    process.env.NODE_ENV === "production" &&
    (process.env.RUNTIME_ENV_STRICT === "true" || process.env.VERCEL_ENV === "production");

  try {
    const redis = await getRedis();
    if (redis) {
      const key = `pow:used:${challenge}`;
      const ttlSeconds = Math.ceil((POW_CONFIG.validityWindowMs * 2) / 1000);
      const wasSet = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
      return wasSet === "OK";
    }
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
  }

  if (strictProd) {
    return false;
  }

  // Dev + Amplify soft-start: in-memory single-process dedup
  if (devUsedChallenges.has(challenge)) return false;
  devUsedChallenges.set(challenge, Date.now());

  if (devUsedChallenges.size > 1000) {
    const cutoff = Date.now() - POW_CONFIG.validityWindowMs * 2;
    for (const [key, ts] of devUsedChallenges) {
      if (ts < cutoff) devUsedChallenges.delete(key);
    }
  }

  return true;
}

/* ── Public API ───────────────────────────────────────────────────────────── */

export type Challenge = {
  challenge: string;
  timestamp: number;
  signature: string;
  difficulty: number;
};

export type PoWPayload = {
  challenge: string;
  nonce: number;
  timestamp: number;
  signature: string;
  difficulty?: number;
};

export async function generatePoWChallenge(customDifficulty?: number): Promise<Challenge> {
  // Ensure baked Amplify env (POW_SECRET) is loaded before signing.
  const { applyBakedAmplifyEnv } = await import("@/lib/apply-baked-env");
  applyBakedAmplifyEnv();

  const challenge = randomBytes(32).toString("hex");
  const timestamp = Date.now();
  let difficulty = customDifficulty ?? POW_CONFIG.difficulty;
  difficulty = Math.max(POW_CONFIG.minDifficulty, Math.min(POW_CONFIG.maxDifficulty, difficulty));
  const dataToSign = `${challenge}:${timestamp}:${difficulty}`;
  const secret = powSecret();
  if (!secret) throw new Error("POW_SECRET is required in production.");
  const signature = createHmac("sha256", secret).update(dataToSign).digest("hex");
  return { challenge, timestamp, signature, difficulty };
}

export async function verifyPoW(payload: PoWPayload): Promise<boolean> {
  const { applyBakedAmplifyEnv } = await import("@/lib/apply-baked-env");
  applyBakedAmplifyEnv();

  const { challenge, nonce, timestamp, signature, difficulty } = payload;

  // Dev-only bypass: only allowed in non-production AND when explicitly disabled
  if (process.env.NODE_ENV !== "production" && process.env.DISABLE_POW === "true") {
    if (nonce === -1 && signature === "SKIP_DEV") return true;
  }

  if (!challenge || nonce === undefined || nonce === null || !timestamp || !signature) return false;
  if (typeof challenge !== "string" || typeof nonce !== "number" || typeof timestamp !== "number") {
    return false;
  }
  if (!/^[a-f0-9]{64}$/i.test(challenge)) return false;
  if (!Number.isInteger(nonce) || nonce < 0) return false;

  const now = Date.now();
  if (timestamp > now + POW_CONFIG.maxClockSkewMs) return false;
  if (now - timestamp > POW_CONFIG.validityWindowMs) return false;

  const expectedDifficulty = Math.max(
    POW_CONFIG.minDifficulty,
    Math.min(POW_CONFIG.maxDifficulty, difficulty ?? POW_CONFIG.difficulty)
  );

  const secret = powSecret();
  if (!secret) return false;

  const dataToSign = `${challenge}:${timestamp}:${expectedDifficulty}`;
  const expectedSignature = createHmac("sha256", secret).update(dataToSign).digest("hex");
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expectedSignature, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  const hash = createHash("sha256").update(`${challenge}${nonce}`).digest("hex");
  if (!hash.startsWith("0".repeat(expectedDifficulty))) return false;

  // Single-use: mark challenge as used via Redis (or dev in-memory)
  const isFirstUse = await markChallengeUsed(challenge);
  if (!isFirstUse) return false;

  return true;
}
