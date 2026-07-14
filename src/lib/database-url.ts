import "server-only";

/**
 * Amplify Hosting truncates environment values at unescaped `&`.
 * Prefer discrete DB_* parts when present; otherwise use DATABASE_URL as-is.
 */
export function resolveDatabaseUrl(): string {
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

  if (assembled) {
    process.env.DATABASE_URL = assembled;
    if (!process.env.DIRECT_URL) process.env.DIRECT_URL = assembled;
    return assembled;
  }

  // Amplify truncates at `&` — many URLs are stored with `%26` instead.
  // Prisma/libpq need real `&` separators at runtime.
  const existing = (process.env.DATABASE_URL ?? "").trim().replace(/%26/gi, "&");
  if (existing && existing !== process.env.DATABASE_URL) {
    process.env.DATABASE_URL = existing;
  }
  const direct = (process.env.DIRECT_URL ?? "").trim().replace(/%26/gi, "&");
  if (direct) process.env.DIRECT_URL = direct;

  return existing;
}

/** Call once before PrismaClient / env validation. */
export function ensureDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.warn(
      "[db] No DATABASE_URL and no DB_HOST/DB_USER/DB_PASSWORD/DB_NAME — set Amplify env vars then redeploy."
    );
  }
  return url;
}
