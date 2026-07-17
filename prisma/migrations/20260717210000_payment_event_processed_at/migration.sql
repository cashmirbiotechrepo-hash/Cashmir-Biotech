-- PaymentEvent was created with CREATE TABLE IF NOT EXISTS in the schema-repair
-- migration, so databases where the table pre-existed never received the
-- processedAt column. Webhook upserts stamp processedAt, so add it idempotently.
ALTER TABLE "PaymentEvent" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
