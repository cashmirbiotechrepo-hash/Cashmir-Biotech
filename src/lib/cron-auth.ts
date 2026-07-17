import { timingSafeEqual } from "crypto";

function safeCompareSecrets(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Authorize cron HTTP invocations. Production requires Bearer CRON_SECRET only.
 * Fails closed when CRON_SECRET is unset.
 */
export function authorizeCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (process.env.NODE_ENV === "production") {
    return Boolean(bearer && safeCompareSecrets(bearer, expected));
  }
  const urlSecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? urlSecret;
  return Boolean(provided && safeCompareSecrets(provided, expected));
}

export function cronSecretMissingResponse() {
  return { ok: false as const, error: "CRON_SECRET is not configured." };
}

export function cronUnauthorizedResponse() {
  return { ok: false as const, error: "Unauthorized." };
}
