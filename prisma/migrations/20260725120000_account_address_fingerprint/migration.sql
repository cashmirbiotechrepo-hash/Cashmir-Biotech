-- Phase B step 1/2: order sync columns + nullable fingerprint + default partial unique.
-- Does NOT require pgcrypto (Amplify/RDS app roles often cannot CREATE EXTENSION).
-- Fingerprint backfill + merge + UNIQUE are applied by:
--   node scripts/ensure-address-fingerprints.cjs
-- after `prisma migrate deploy` (see amplify.yml).
--
-- OPERATIONAL GATE before destructive merge (inside ensure script when surplus > 0
-- and ALLOW_ADDRESS_FINGERPRINT_MERGE is not set): review count output first.

-- Order consent / sync columns
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "saveAddressToAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "accountAddressLabel" TEXT NOT NULL DEFAULT 'Home';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "selectedAddressId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "accountSyncedAt" TIMESTAMP(3);

-- Fingerprint column (nullable until ensure-address-fingerprints.cjs)
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
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAddress_customerId_isDefault_uidx"
  ON "CustomerAddress" ("customerId")
  WHERE "isDefault" = true;
