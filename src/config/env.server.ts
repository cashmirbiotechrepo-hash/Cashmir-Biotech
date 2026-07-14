import "server-only";
import { z } from "zod";

const KNOWN_INSECURE = new Set([
  "dev-encryption-key-32-chars-lo!!",
  "dev-only-insecure-pepper-32chars!",
  "ci-test-jwt-secret-do-not-use-in-prod-32chars",
  "ci-test-pepper-do-not-use-in-prod-32chars",
  "ci-test-pow-secret-do-not-use-in-prod-32chars"
]);

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    /** Optional dedicated secret for Customer Portal JWTs (falls back to JWT_SECRET). */
    CUSTOMER_JWT_SECRET: z.string().min(32).optional(),
    /** 32-byte ASCII key for JWE cookie encryption. Required in production. */
    ENCRYPTION_KEY: z.string().length(32).optional(),
    /** HMAC pepper for password hashing. Required in production. */
    PASSWORD_PEPPER: z.string().min(32).optional(),
    /** Bootstrap owner — migrated into AdminUser table on seed */
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD_HASH: z.string().min(1).optional(),
    /** Required in production for cron auth: Authorization: Bearer <CRON_SECRET> */
    CRON_SECRET: z.string().min(16).optional(),
    /** Public site origin — required in production for invite/email links */
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    POW_SECRET: z.string().min(16).optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(8).optional(),
    RAZORPAY_KEY_ID: z.string().min(1).optional(),
    RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional()
  })
  .superRefine((val, ctx) => {
    // During `next build`, NODE_ENV is production — require core secrets always,
    // money/redis only when actually deploying to a live environment.
    if (process.env.NODE_ENV !== "production") return;

    const liveDeploy =
      process.env.VERCEL_ENV === "production" || process.env.RUNTIME_ENV_STRICT === "true";

    const require = (key: keyof typeof val, message: string) => {
      if (!val[key]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [key] });
      }
    };

    require("ENCRYPTION_KEY", "ENCRYPTION_KEY (32 chars) is required in production.");
    require("PASSWORD_PEPPER", "PASSWORD_PEPPER (≥32 chars) is required in production.");
    require("CRON_SECRET", "CRON_SECRET (≥16 chars) is required in production.");
    require("POW_SECRET", "POW_SECRET (≥16 chars) is required in production.");
    require("NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SITE_URL is required in production.");

    if (liveDeploy) {
      require("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_URL is required in production.");
      require("UPSTASH_REDIS_REST_TOKEN", "UPSTASH_REDIS_REST_TOKEN is required in production.");
      require("RAZORPAY_KEY_ID", "RAZORPAY_KEY_ID is required in production.");
      require("RAZORPAY_KEY_SECRET", "RAZORPAY_KEY_SECRET is required in production.");
      require("RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_WEBHOOK_SECRET is required in production.");
    }

    for (const [key, value] of Object.entries(val)) {
      if (typeof value === "string" && KNOWN_INSECURE.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} uses a known development/CI secret — rotate before production deploy.`,
          path: [key]
        });
      }
    }

    if (liveDeploy) {
      if (process.env.CHECKOUT_SKIP_PAYMENT === "true" || process.env.CHECKOUT_SKIP_PAYMENT === "1") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CHECKOUT_SKIP_PAYMENT must not be enabled in production.",
          path: ["CHECKOUT_SKIP_PAYMENT"]
        });
      }
      if (
        process.env.NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT === "true" ||
        process.env.NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT === "1"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT must not be set in production builds.",
          path: ["NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT"]
        });
      }
      if (process.env.E2E_HOOKS_ENABLED === "true" || process.env.E2E_HOOKS_ENABLED === "1") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "E2E_HOOKS_ENABLED must not be enabled in production.",
          path: ["E2E_HOOKS_ENABLED"]
        });
      }
    }
  });

function normalizeProcessEnv() {
  const p = { ...process.env } as Record<string, string | undefined>;
  if (p.ADMIN_EMAIL === "") p.ADMIN_EMAIL = undefined;
  if (p.ADMIN_PASSWORD_HASH === "") p.ADMIN_PASSWORD_HASH = undefined;
  return p;
}

/**
 * Validated server-side environment. Import only from Server Components, Route Handlers, and server-only modules.
 */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const env: ServerEnv = serverEnvSchema.parse(normalizeProcessEnv());
