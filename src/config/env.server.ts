import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  /** 32-byte ASCII key for JWE cookie encryption */
  ENCRYPTION_KEY: z.string().length(32).optional(),
  /** HMAC pepper for password hashing (≥32 chars recommended) */
  PASSWORD_PEPPER: z.string().min(32).optional(),
  /** Bootstrap owner — migrated into AdminUser table on seed */
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
