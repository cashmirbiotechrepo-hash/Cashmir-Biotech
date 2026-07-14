import "server-only";

/**
 * R8 — Prefer a pooler-safe DATABASE_URL for serverless Prisma.
 * Accepts any of:
 * - query param connection_limit=
 * - query param pgbouncer=true
 * - Prisma Data Proxy / Accelerate (prisma+postgres / prisma://)
 * - Neon / Supabase pooler host markers (-pooler. / pooler.supabase)
 *
 * Amplify truncates unescaped `&` in env values, so this is advisory — never crash boot.
 */
export function databaseUrlLooksPooled(url: string): boolean {
  if (!url) return false;
  const lower = decodeURIComponent(url).toLowerCase().replace(/%26/g, "&");
  if (lower.startsWith("prisma+") || lower.startsWith("prisma://")) return true;
  if (lower.includes("connection_limit=")) return true;
  if (lower.includes("pgbouncer=true") || lower.includes("pgbouncer=1")) return true;
  if (lower.includes("-pooler.") || lower.includes("pooler.supabase")) return true;
  if (lower.includes(".pooler.")) return true;
  return false;
}

/**
 * Soft check only. Amplify Hosting previously 500'd the entire site when this threw
 * because `&connection_limit=` was stripped from DATABASE_URL at runtime.
 */
export function assertProductionDatabasePooling(url = process.env.DATABASE_URL ?? ""): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ALLOW_UNPOOLED_DATABASE_URL === "true" || process.env.ALLOW_UNPOOLED_DATABASE_URL === "1") {
    return;
  }
  if (databaseUrlLooksPooled(url)) return;

  // Warn — do not throw. A hard throw bricks Amplify SSR before any page can load.
  console.warn(
    "[db-pool] DATABASE_URL has no pooling markers (connection_limit / pgbouncer / pooler host). " +
      "On Amplify, encode & as %26 in the URL or set ALLOW_UNPOOLED_DATABASE_URL=true. Continuing startup."
  );
}
