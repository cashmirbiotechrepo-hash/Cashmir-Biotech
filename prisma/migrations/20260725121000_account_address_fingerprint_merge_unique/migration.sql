-- Phase B step 2/2: merge fingerprint duplicates → NOT NULL + UNIQUE.
--
-- ⚠ GATE — do not apply until:
--   npx tsx scripts/count-address-fingerprint-dupes.ts
-- has been run on this environment and a human has signed off on surplusRows
-- (or surplus is already 0). Applying without review silently deletes address rows.
--
-- Prerequisite: 20260725120000_account_address_fingerprint (backfill) applied.

-- Keep survivor: default in group if any, else latest updatedAt/createdAt/id.
WITH ranked AS (
  SELECT
    id,
    "customerId",
    fingerprint,
    ROW_NUMBER() OVER (
      PARTITION BY "customerId", fingerprint
      ORDER BY "isDefault" DESC, "updatedAt" DESC, "createdAt" DESC, id ASC
    ) AS rn
  FROM "CustomerAddress"
  WHERE fingerprint IS NOT NULL
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM "CustomerAddress" AS a
USING losers l
WHERE a.id = l.id;

-- Re-assert single default after deletes
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
WHERE a.id = r.id AND r.rn > 1;

-- Promote a default when a customer has addresses but none default
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
WHERE a.id = pick.id;

ALTER TABLE "CustomerAddress" ALTER COLUMN "fingerprint" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAddress_customerId_fingerprint_key"
  ON "CustomerAddress" ("customerId", "fingerprint");
