-- Phase B step 1/2: order sync columns + fingerprint BACKFILL only.
-- Does NOT merge duplicates or add UNIQUE(customerId, fingerprint).
--
-- OPERATIONAL GATE (required before step 2):
--   1. Deploy / apply this migration on staging (then prod).
--   2. Run: npx tsx scripts/count-address-fingerprint-dupes.ts
--   3. Human reviews surplusRows / sample groups.
--   4. Only then apply: 20260725121000_account_address_fingerprint_merge_unique
--
-- Sequence (plan §8.3): add columns → fix multi-defaults → backfill → [GATE] → merge → UNIQUE.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Order consent / sync columns
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "saveAddressToAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "accountAddressLabel" TEXT NOT NULL DEFAULT 'Home';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "selectedAddressId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "accountSyncedAt" TIMESTAMP(3);

-- Fingerprint column (nullable until merge migration)
ALTER TABLE "CustomerAddress" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;

-- Ensure at most one default per customer before partial unique
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

-- Manual partial unique — also documented on CustomerAddress in schema.prisma.
-- Prisma schema DSL cannot express WHERE isDefault = true; preserve this index.
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAddress_customerId_isDefault_uidx"
  ON "CustomerAddress" ("customerId")
  WHERE "isDefault" = true;

-- Backfill fingerprints (must match src/lib/customer/addresses.ts addressFingerprint)
UPDATE "CustomerAddress" AS a
SET "fingerprint" = encode(
  digest(
    lower(regexp_replace(trim(a."fullName"), '\s+', ' ', 'g')) || E'\000' ||
    (
      CASE
        WHEN length(regexp_replace(a."phone", '\D', '', 'g')) = 12
          AND regexp_replace(a."phone", '\D', '', 'g') LIKE '91%'
          THEN substring(regexp_replace(a."phone", '\D', '', 'g') FROM 3)
        WHEN length(regexp_replace(a."phone", '\D', '', 'g')) = 11
          AND regexp_replace(a."phone", '\D', '', 'g') LIKE '0%'
          THEN substring(regexp_replace(a."phone", '\D', '', 'g') FROM 2)
        ELSE regexp_replace(a."phone", '\D', '', 'g')
      END
    ) || E'\000' ||
    lower(regexp_replace(trim(a."line1"), '\s+', ' ', 'g')) || E'\000' ||
    lower(regexp_replace(trim(a."line2"), '\s+', ' ', 'g')) || E'\000' ||
    lower(regexp_replace(trim(a."city"), '\s+', ' ', 'g')) || E'\000' ||
    lower(regexp_replace(trim(a."state"), '\s+', ' ', 'g')) || E'\000' ||
    (
      CASE
        WHEN lower(regexp_replace(trim(a."country"), '\s+', ' ', 'g')) IN ('india', 'in')
          THEN left(regexp_replace(a."postalCode", '\D', '', 'g'), 6)
        ELSE regexp_replace(a."postalCode", '\D', '', 'g')
      END
    ) || E'\000' ||
    COALESCE(NULLIF(lower(regexp_replace(trim(a."country"), '\s+', ' ', 'g')), ''), 'india'),
    'sha256'
  ),
  'hex'
)
WHERE a."fingerprint" IS NULL;

-- STOP HERE. Do not delete duplicates or add fingerprint UNIQUE in this migration.
