#!/usr/bin/env npx tsx
/**
 * OPERATIONAL GATE (plan §8.3 / round 7):
 * Read-only dry-run — count CustomerAddress duplicate groups by fingerprint.
 *
 * Deploy order:
 *   1. Apply migration 20260725120000_account_address_fingerprint (backfill only)
 *   2. Run THIS script on that environment; review surplusRows + sample
 *   3. Human sign-off
 *   4. Only then apply 20260725121000_account_address_fingerprint_merge_unique
 *
 * Exit codes:
 *   0 — surplusRows === 0 (safe to apply merge+unique)
 *   2 — surplusRows > 0 (GATE FAIL — do not apply merge migration yet)
 *   1 — script / DB error
 *
 * Usage: npx tsx scripts/count-address-fingerprint-dupes.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const groups = await db.$queryRaw<
    Array<{ customerId: string; fingerprint: string; n: bigint }>
  >`
    SELECT "customerId", fingerprint, COUNT(*)::bigint AS n
    FROM "CustomerAddress"
    WHERE fingerprint IS NOT NULL
    GROUP BY "customerId", fingerprint
    HAVING COUNT(*) > 1
    ORDER BY n DESC
  `;

  const surplus = groups.reduce((sum, g) => sum + (Number(g.n) - 1), 0);
  const payload = {
    duplicateGroups: groups.length,
    surplusRows: surplus,
    sample: groups.slice(0, 20).map((g) => ({
      customerId: g.customerId,
      fingerprint: g.fingerprint,
      n: Number(g.n)
    })),
    nextStep:
      surplus === 0
        ? "GATE PASS — safe to apply 20260725121000_account_address_fingerprint_merge_unique"
        : "GATE FAIL — review sample, then apply merge only after human sign-off (or re-run after manual cleanup)"
  };
  console.log(JSON.stringify(payload, null, 2));

  if (surplus > 0) {
    process.exit(2);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
