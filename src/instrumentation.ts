/**
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 * Runs once when the Node server or a new serverless context starts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    const { applyBakedAmplifyEnv } = await import("@/lib/apply-baked-env");
    applyBakedAmplifyEnv();
    const { ensureDatabaseUrl } = await import("@/lib/database-url");
    ensureDatabaseUrl();
    const { assertProductionDatabasePooling, databaseUrlLooksPooled } = await import("@/lib/db-pool");
    assertProductionDatabasePooling();

    // Soft-start on Amplify: only hard-require money/SMTP when explicitly strict
    // (or Vercel production). Avoid AWS_BRANCH=main triggering at first boot.
    if (process.env.VERCEL_ENV === "production" || process.env.RUNTIME_ENV_STRICT === "true") {
      const missing: string[] = [];
      for (const key of [
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
        "SMTP_HOST",
        "SMTP_USER",
        "SMTP_PASS",
        "NEXT_PUBLIC_SITE_URL"
      ]) {
        if (!process.env[key]) missing.push(key);
      }
      if (missing.length) {
        throw new Error(
          `Production runtime missing required env: ${missing.join(", ")}. Refusing to start.`
        );
      }
    }

    const { logger } = await import("@/lib/logger");
    logger.info(
      {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        awsBranch: process.env.AWS_BRANCH,
        runtimeStrict: process.env.RUNTIME_ENV_STRICT === "true",
        upstash: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
        dbPooled: databaseUrlLooksPooled(process.env.DATABASE_URL || "")
      },
      "server runtime started"
    );
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>
) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};
