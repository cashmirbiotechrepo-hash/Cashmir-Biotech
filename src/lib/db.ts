import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "@/lib/database-url";
import { assertProductionDatabasePooling, databaseUrlLooksPooled } from "@/lib/db-pool";
import { logger } from "@/lib/logger";

const databaseUrl = ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function initPoolGuards() {
  assertProductionDatabasePooling(databaseUrl);

  if (process.env.NODE_ENV === "production" && databaseUrlLooksPooled(databaseUrl)) {
    logger.info({ event: "db_pool_ok" }, "DATABASE_URL looks pooler-configured");
  } else if (process.env.NODE_ENV !== "production" && !databaseUrlLooksPooled(databaseUrl)) {
    logger.warn(
      { event: "db_pool_dev_hint" },
      "DATABASE_URL has no connection_limit/pgbouncer — fine for local Postgres; required before Vercel production."
    );
  }
}

initPoolGuards();

function createPrismaClient() {
  // Pass url explicitly — Prisma's env("DATABASE_URL") fails when Amplify omits it
  // even after we assemble it into process.env at runtime.
  return new PrismaClient({
    log: ["error", "warn"],
    ...(databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrl }
          }
        }
      : {})
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
