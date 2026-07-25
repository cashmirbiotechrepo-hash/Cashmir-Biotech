/**
 * Amplify / ops: backfill CustomerAddress.fingerprint with Node sha256 (same as
 * src/lib/customer/addresses.ts), merge duplicate groups, then NOT NULL + UNIQUE.
 *
 * Does not use Postgres pgcrypto (CREATE EXTENSION often denied on Amplify RDS roles).
 *
 * Env:
 *   ALLOW_ADDRESS_FINGERPRINT_MERGE=1 — required when surplusRows > 0 (human signed off)
 *   FAIL_ON_ERROR=1 — exit non-zero on failure (Amplify sets this)
 *
 * Usage: node scripts/ensure-address-fingerprints.cjs
 */
const { createHash } = require("crypto");
const { PrismaClient } = require("@prisma/client");

function collapseWs(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function fold(s) {
  return collapseWs(s).toLowerCase();
}

function normalizePhoneForMatch(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function normalizeAddressFields(row) {
  const country = fold(row.country || "India");
  let postal = String(row.postalCode ?? "").replace(/\D/g, "");
  if (country === "india" || country === "in") postal = postal.slice(0, 6);
  return {
    fullName: fold(row.fullName),
    phone: normalizePhoneForMatch(row.phone),
    line1: fold(row.line1),
    line2: fold(row.line2 ?? ""),
    city: fold(row.city),
    state: fold(row.state),
    postalCode: postal,
    country: country || "india"
  };
}

function addressFingerprint(row) {
  const n = normalizeAddressFields(row);
  const canonical = [
    n.fullName,
    n.phone,
    n.line1,
    n.line2,
    n.city,
    n.state,
    n.postalCode,
    n.country
  ].join("\0");
  return createHash("sha256").update(canonical).digest("hex");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[ensure-fingerprints] DATABASE_URL missing — skip");
    return;
  }

  const prisma = new PrismaClient();
  try {
    // Column may not exist yet if migrate failed before ADD COLUMN.
    const cols = await prisma.$queryRawUnsafe(`
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'CustomerAddress'
        AND column_name = 'fingerprint'
      LIMIT 1
    `);
    if (!cols.length) {
      console.warn("[ensure-fingerprints] fingerprint column missing — run migrate deploy first");
      if (process.env.FAIL_ON_ERROR === "1") process.exit(1);
      return;
    }

    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, "fullName", phone, line1, line2, city, state, "postalCode", country, fingerprint
      FROM "CustomerAddress"
      WHERE fingerprint IS NULL OR fingerprint = ''
    `);

    let updated = 0;
    for (const row of rows) {
      const fp = addressFingerprint(row);
      await prisma.$executeRawUnsafe(
        `UPDATE "CustomerAddress" SET fingerprint = $1 WHERE id = $2`,
        fp,
        row.id
      );
      updated += 1;
    }
    console.log(`[ensure-fingerprints] backfilled ${updated} row(s)`);

    const groups = await prisma.$queryRawUnsafe(`
      SELECT "customerId", fingerprint, COUNT(*)::bigint AS n
      FROM "CustomerAddress"
      WHERE fingerprint IS NOT NULL AND fingerprint <> ''
      GROUP BY "customerId", fingerprint
      HAVING COUNT(*) > 1
    `);
    const surplus = groups.reduce((sum, g) => sum + (Number(g.n) - 1), 0);
    console.log(
      `[ensure-fingerprints] duplicateGroups=${groups.length} surplusRows=${surplus}`
    );

    if (surplus > 0 && process.env.ALLOW_ADDRESS_FINGERPRINT_MERGE !== "1") {
      console.error(
        "[ensure-fingerprints] GATE: surplusRows > 0. Review duplicates, then re-run with ALLOW_ADDRESS_FINGERPRINT_MERGE=1"
      );
      console.error(
        "[ensure-fingerprints] sample:",
        JSON.stringify(groups.slice(0, 10), (_, v) => (typeof v === "bigint" ? Number(v) : v))
      );
      process.exit(2);
    }

    if (surplus > 0) {
      await prisma.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY "customerId", fingerprint
              ORDER BY "isDefault" DESC, "updatedAt" DESC, "createdAt" DESC, id ASC
            ) AS rn
          FROM "CustomerAddress"
          WHERE fingerprint IS NOT NULL AND fingerprint <> ''
        ),
        losers AS (
          SELECT id FROM ranked WHERE rn > 1
        )
        DELETE FROM "CustomerAddress" AS a
        USING losers l
        WHERE a.id = l.id
      `);
      console.log(`[ensure-fingerprints] merged — deleted ${surplus} surplus row(s)`);
    }

    // Re-assert ≤1 default per customer
    await prisma.$executeRawUnsafe(`
      WITH ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY "customerId"
            ORDER BY "isDefault" DESC, "updatedAt" DESC, "createdAt" DESC, id ASC
          ) AS rn
        FROM "CustomerAddress"
        WHERE "isDefault" = true
      )
      UPDATE "CustomerAddress" AS a
      SET "isDefault" = false
      FROM ranked r
      WHERE a.id = r.id AND r.rn > 1
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "CustomerAddress" AS a
      SET "isDefault" = true
      FROM (
        SELECT DISTINCT ON ("customerId") id
        FROM "CustomerAddress"
        WHERE "customerId" IN (
          SELECT "customerId" FROM "CustomerAddress" GROUP BY "customerId"
          HAVING bool_or("isDefault") = false
        )
        ORDER BY "customerId", "updatedAt" DESC, "createdAt" DESC, id ASC
      ) pick
      WHERE a.id = pick.id
    `);

    const stillNull = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::bigint AS n FROM "CustomerAddress"
      WHERE fingerprint IS NULL OR fingerprint = ''
    `);
    if (Number(stillNull[0].n) > 0) {
      throw new Error(`Cannot set NOT NULL — ${stillNull[0].n} rows still missing fingerprint`);
    }

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CustomerAddress" ALTER COLUMN "fingerprint" SET NOT NULL`
    );
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAddress_customerId_fingerprint_key"
        ON "CustomerAddress" ("customerId", "fingerprint")
    `);

    console.log("[ensure-fingerprints] fingerprint NOT NULL + UNIQUE ready");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[ensure-fingerprints] failed:", err?.message || err);
  process.exit(process.env.FAIL_ON_ERROR === "1" ? 1 : 0);
});
