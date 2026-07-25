-- Phase B step 2/2 marker migration.
--
-- Real merge + fingerprint NOT NULL + UNIQUE(customerId, fingerprint) are applied by
-- scripts/ensure-address-fingerprints.cjs after migrate deploy.
--
-- Why: Amplify's DB role cannot CREATE EXTENSION pgcrypto, and SQL sha256 backfill
-- needs that extension. Node crypto matches src/lib/customer/addresses.ts instead.
-- Also keeps merge behind an explicit script (set ALLOW_ADDRESS_FINGERPRINT_MERGE=1
-- when surplus > 0 after human review).

SELECT 1;
