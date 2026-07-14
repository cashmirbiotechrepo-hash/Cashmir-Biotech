/**
 * Amplify SSR compute often does not receive console env vars at runtime.
 * This script runs during amplify.yml build (when env IS available) and writes
 * a JSON file that the server bundle can load on every cold start.
 */
const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");

const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_SSLMODE",
  "JWT_SECRET",
  "PASSWORD_PEPPER",
  "ENCRYPTION_KEY",
  "CRON_SECRET",
  "POW_SECRET",
  "ALLOW_UNPOOLED_DATABASE_URL",
  "RUNTIME_ENV_STRICT",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "INVENTORY_ALERT_EMAIL"
];

const out = {};
for (const key of KEYS) {
  const val = process.env[key];
  if (val != null && String(val).length > 0) out[key] = String(val).trim().replace(/^["']+|["']+$/g, "");
}

// Drop malformed Upstash REST URL so Zod/build does not crash (common Amplify paste typo).
if (out.UPSTASH_REDIS_REST_URL) {
  try {
    const u = new URL(out.UPSTASH_REDIS_REST_URL);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      console.warn("[write-amplify-runtime-env] Ignoring invalid UPSTASH_REDIS_REST_URL (bad protocol)");
      delete out.UPSTASH_REDIS_REST_URL;
      delete out.UPSTASH_REDIS_REST_TOKEN;
    }
  } catch {
    console.warn("[write-amplify-runtime-env] Ignoring invalid UPSTASH_REDIS_REST_URL (not a URL)");
    delete out.UPSTASH_REDIS_REST_URL;
    delete out.UPSTASH_REDIS_REST_TOKEN;
  }
}

// Prefer DB_* assembly so Amplify & truncation never ships a broken URL.
if (out.DB_HOST && out.DB_USER && out.DB_PASSWORD && out.DB_NAME) {
  const port = out.DB_PORT || "5432";
  const ssl = out.DB_SSLMODE || "require";
  const assembled = `postgresql://${encodeURIComponent(out.DB_USER)}:${encodeURIComponent(out.DB_PASSWORD)}@${out.DB_HOST}:${port}/${out.DB_NAME}?sslmode=${encodeURIComponent(ssl)}`;
  out.DATABASE_URL = assembled;
  out.DIRECT_URL = assembled;
}

const dir = resolve(process.cwd(), "src/generated");
mkdirSync(dir, { recursive: true });
const file = resolve(dir, "amplify-runtime-env.json");
writeFileSync(file, JSON.stringify(out, null, 2) + "\n", "utf8");

const count = Object.keys(out).length;
console.log(`[write-amplify-runtime-env] wrote ${count} keys → ${file}`);
if (!out.DATABASE_URL) {
  console.error("[write-amplify-runtime-env] DATABASE_URL still empty — set DATABASE_URL or DB_* in Amplify.");
  process.exit(1);
}
if (!out.JWT_SECRET) {
  console.error("[write-amplify-runtime-env] JWT_SECRET missing.");
  process.exit(1);
}
