-- Ensure the outbox table exists before deduping and adding the unique constraint.
CREATE TABLE IF NOT EXISTS "OrderTask" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT NOT NULL DEFAULT '',
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderTask_status_createdAt_idx" ON "OrderTask"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderTask_orderId_idx" ON "OrderTask"("orderId");

DO $$ BEGIN
  ALTER TABLE "OrderTask" ADD CONSTRAINT "OrderTask_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Deduplicate post_payment tasks before adding unique constraint.
DELETE FROM "OrderTask" a
USING "OrderTask" b
WHERE a.id > b.id
  AND a."orderId" = b."orderId"
  AND a.type = b.type;

CREATE UNIQUE INDEX IF NOT EXISTS "OrderTask_orderId_type_key" ON "OrderTask"("orderId", "type");
