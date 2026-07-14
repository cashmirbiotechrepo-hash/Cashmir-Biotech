import { PrismaClient } from "@prisma/client";
import { assertProductionDatabasePooling, databaseUrlLooksPooled } from "@/lib/db-pool";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function initPoolGuards() {
  const url = process.env.DATABASE_URL || "";
  assertProductionDatabasePooling(url);

  if (process.env.NODE_ENV === "production" && databaseUrlLooksPooled(url)) {
    logger.info({ event: "db_pool_ok" }, "DATABASE_URL looks pooler-configured");
  } else if (process.env.NODE_ENV !== "production" && !databaseUrlLooksPooled(url)) {
    logger.warn(
      { event: "db_pool_dev_hint" },
      "DATABASE_URL has no connection_limit/pgbouncer — fine for local Postgres; required before Vercel production."
    );
  }
}

initPoolGuards();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
