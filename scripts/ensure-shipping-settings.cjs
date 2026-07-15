/**
 * Idempotent: ensure SiteSettings has store-wide shipping columns (Amplify + ops).
 * Safe to re-run; does not touch existing values.
 *
 * Amplify: soft-fails if build host cannot reach RDS.
 * Manual: set FAIL_ON_ERROR=1 to exit non-zero on failure.
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[ensure-shipping] DATABASE_URL missing — skip");
    return;
  }
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "flatShippingInr" INTEGER NOT NULL DEFAULT 60'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "freeShippingThresholdInr" INTEGER NOT NULL DEFAULT 999'
    );
    console.log("[ensure-shipping] SiteSettings shipping columns ready");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.warn("[ensure-shipping] failed:", err?.message || err);
  process.exit(process.env.FAIL_ON_ERROR === "1" ? 1 : 0);
});
