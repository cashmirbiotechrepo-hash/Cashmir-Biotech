/**
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * Runs once when the Node server or a new serverless context starts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("@/lib/logger");
    logger.info(
      { nodeEnv: process.env.NODE_ENV, upstash: Boolean(process.env.UPSTASH_REDIS_REST_URL) },
      "server runtime started"
    );
  }
}
