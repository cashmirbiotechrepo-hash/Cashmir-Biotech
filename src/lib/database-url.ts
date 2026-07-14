import "server-only";

/**
 * Amplify Hosting truncates environment values at unescaped `&`.
 * Prefer a full DATABASE_URL when it is intact; otherwise assemble from
 * DB_HOST / DB_USER / DB_PASSWORD / DB_NAME (no ampersands in those values).
 */
export function resolveDatabaseUrl(): string {
  const existing = (process.env.DATABASE_URL ?? "").trim();
  const host = (process.env.DB_HOST ?? "").trim();
  const user = (process.env.DB_USER ?? "").trim();
  const password = process.env.DB_PASSWORD ?? "";
  const name = (process.env.DB_NAME ?? "").trim();
  const port = (process.env.DB_PORT ?? "5432").trim() || "5432";
  const sslmode = (process.env.DB_SSLMODE ?? "require").trim() || "require";

  const assembled =
    host && user && password && name
      ? `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?sslmode=${encodeURIComponent(sslmode)}`
      : "";

  // Prefer assembled URL when discrete Amplify parts are present — avoids truncated & URLs.
  if (assembled) {
    process.env.DATABASE_URL = assembled;
    if (!process.env.DIRECT_URL) process.env.DIRECT_URL = assembled;
    return assembled;
  }

  return existing;
}

/** Call once before PrismaClient is constructed. */
export function ensureDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.warn("[db] DATABASE_URL missing and DB_HOST/DB_USER/DB_PASSWORD/DB_NAME not set");
  }
  return url;
}
