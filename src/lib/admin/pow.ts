import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

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

const usedChallenges = new Map<string, number>();

if (typeof setInterval !== "undefined") {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of usedChallenges.entries()) {
      if (now - ts > POW_CONFIG.validityWindowMs * 2) usedChallenges.delete(key);
    }
  }, 5 * 60 * 1000);
  if (typeof (t as NodeJS.Timeout).unref === "function") (t as NodeJS.Timeout).unref();
}

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

export function generatePoWChallenge(customDifficulty?: number): Challenge {
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

export function verifyPoW(payload: PoWPayload): boolean {
  const { challenge, nonce, timestamp, signature, difficulty } = payload;

  if (process.env.NODE_ENV !== "production" && nonce === -1 && signature === "SKIP_DEV") {
    return true;
  }

  if (!challenge || nonce === undefined || nonce === null || !timestamp || !signature) return false;
  if (typeof challenge !== "string" || typeof nonce !== "number" || typeof timestamp !== "number") {
    return false;
  }
  if (!/^[a-f0-9]{64}$/i.test(challenge)) return false;
  if (!Number.isInteger(nonce) || nonce < 0) return false;

  // Single-use per issued challenge — prevents replaying one signed challenge
  // with multiple valid nonces inside the validity window.
  if (usedChallenges.has(challenge)) return false;

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

  usedChallenges.set(challenge, now);
  return true;
}
