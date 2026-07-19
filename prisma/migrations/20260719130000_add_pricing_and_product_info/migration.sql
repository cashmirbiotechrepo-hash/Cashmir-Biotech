-- Additive pricing + product information. Keep mrpInr / pricePaise / stockQty / sku.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "taxIncluded" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minOrderQty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxOrderQty" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "measurements" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "specs" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "usage" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "otherInfo" JSONB;

-- Backfill selling price from MRP when missing or zero (zero is unsafe as a real price).
UPDATE "Product" SET "pricePaise" = "mrpInr" * 100 WHERE "pricePaise" IS NULL OR "pricePaise" = 0;

CREATE TABLE IF NOT EXISTS "ProductCustomField" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCustomField_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductCustomField_productId_sortOrder_idx" ON "ProductCustomField"("productId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductCustomField_productId_fkey'
  ) THEN
    ALTER TABLE "ProductCustomField"
      ADD CONSTRAINT "ProductCustomField_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
