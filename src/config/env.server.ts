import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  /** Set in production; optional at build time if admin console is not configured. */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().min(1).optional()
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
