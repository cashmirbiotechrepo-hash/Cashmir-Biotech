import "server-only";

/**
 * R8 — Production DATABASE_URL must use a pooler-safe configuration for serverless Prisma.
 * Accepts any of:
 * - query param connection_limit=
 * - query param pgbouncer=true
 * - Prisma Data Proxy / Accelerate (prisma+postgres / prisma://)
 * - Neon / Supabase pooler host markers (-pooler. / pooler.supabase)
 */
export function databaseUrlLooksPooled(url: string): boolean {
  if (!url) return false;
  // Amplify / some hosts truncate env vars at unescaped `&` — accept percent-encoded forms too.
  const lower = url.toLowerCase().replace(/%26/g, "&");
  if (lower.startsWith("prisma+") || lower.startsWith("prisma://")) return true;
  if (lower.includes("connection_limit=")) return true;
  if (lower.includes("pgbouncer=true") || lower.includes("pgbouncer=1")) return true;
  if (lower.includes("-pooler.") || lower.includes("pooler.supabase")) return true;
  if (lower.includes(".pooler.")) return true;
  return false;
}

/**
 * Throws in production when DATABASE_URL is unpooled unless explicitly overridden.
 * Safe no-op in development / test / when ALLOW_UNPOOLED_DATABASE_URL=true (single VM deploy).
 */
export function assertProductionDatabasePooling(url = process.env.DATABASE_URL ?? ""): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ALLOW_UNPOOLED_DATABASE_URL === "true" || process.env.ALLOW_UNPOOLED_DATABASE_URL === "1") {
    return;
  }
  // Amplify Hosting SSR truncates `?a=1&b=2` env values at `&` unless `%26`-encoded.
  // Treat Amplify apps as allowed to use direct RDS with connection_limit when present,
  // or soft-allow when AWS_APP_ID is set (managed compute) so first boots aren't bricked.
  if (process.env.AWS_APP_ID || process.env.AWS_BRANCH) {
    if (databaseUrlLooksPooled(url) || process.env.AWS_APP_ID) {
      return;
    }
  }
  if (databaseUrlLooksPooled(url)) return;

  throw new Error(
    "DATABASE_URL must include connection pooling for production serverless deploys " +
      "(e.g. ?connection_limit=5&pool_timeout=10, pgbouncer=true, or a Neon/Supabase pooler host). " +
      "On Amplify, encode & as %26 in the URL, or set ALLOW_UNPOOLED_DATABASE_URL=true. " +
      "Set ALLOW_UNPOOLED_DATABASE_URL=true only for a single long-lived Node process (non-serverless)."
  );
}
