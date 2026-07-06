import "server-only";
import pino from "pino";

/**
 * JSON logs (works in Next.js dev/build — no worker/subprocess transport).
 * Pipe dev output through `npx pino-pretty` if you want colors: `npm run dev 2>&1 | npx pino-pretty`
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug")
});
