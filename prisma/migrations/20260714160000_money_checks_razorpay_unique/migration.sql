-- R7: money integrity CHECKs + unique razorpayOrderId (NULL when unset)

-- 1) Allow NULLs on razorpayOrderId (Prisma may have stored NOT NULL as a named check).
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_razorpayOrderId_not_null";
ALTER TABLE "Order" ALTER COLUMN "razorpayOrderId" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "razorpayOrderId" DROP DEFAULT;

-- 2) Empty string → NULL (many pending / skip-pay orders share "").
UPDATE "Order" SET "razorpayOrderId" = NULL WHERE "razorpayOrderId" IS NULL OR btrim("razorpayOrderId") = '';

-- 3) Deduplicate any remaining duplicate provider ids (keep oldest).
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "razorpayOrderId" ORDER BY "createdAt" ASC) AS rn
  FROM "Order"
  WHERE "razorpayOrderId" IS NOT NULL
)
UPDATE "Order" o
SET "razorpayOrderId" = NULL
FROM dups
WHERE o.id = dups.id AND dups.rn > 1;

-- 4) Normalize money fields before CHECKs.
UPDATE "Order"
SET "totalCents" = GREATEST(
  0,
  "subtotalCents" - COALESCE("discountCents", 0) + "taxCents" + "shippingCents"
)
WHERE "totalCents" <> ("subtotalCents" - COALESCE("discountCents", 0) + "taxCents" + "shippingCents");

UPDATE "Order"
SET "refundedCents" = LEAST(GREATEST(COALESCE("refundedCents", 0), 0), "totalCents")
WHERE COALESCE("refundedCents", 0) < 0 OR COALESCE("refundedCents", 0) > "totalCents";

UPDATE "Order" SET "razorpayPaymentId" = '' WHERE "razorpayPaymentId" IS NULL;

DROP INDEX IF EXISTS "Order_razorpayOrderId_key";
DROP INDEX IF EXISTS "Order_razorpayOrderId_idx";
CREATE UNIQUE INDEX "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_money_nonneg";
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_nonneg" CHECK (
  "subtotalCents" >= 0
  AND "taxCents" >= 0
  AND "shippingCents" >= 0
  AND COALESCE("discountCents", 0) >= 0
  AND "totalCents" >= 0
  AND "refundedCents" >= 0
  AND "refundedCents" <= "totalCents"
);

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_total_consistency";
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_consistency" CHECK (
  "totalCents" = "subtotalCents" - COALESCE("discountCents", 0) + "taxCents" + "shippingCents"
);

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_qty_price_nonneg";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_price_nonneg" CHECK (
  "quantity" > 0 AND "unitPriceCents" >= 0
);

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_money_nonneg";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_money_nonneg" CHECK (
  "subtotalCents" >= 0
  AND "taxCents" >= 0
  AND "totalCents" >= 0
  AND "totalCents" >= "subtotalCents"
);

ALTER TABLE "Quote" DROP CONSTRAINT IF EXISTS "Quote_total_nonneg";
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_total_nonneg" CHECK ("totalCents" >= 0);

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_amount_nonneg";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_nonneg" CHECK ("amountCents" >= 0 AND "gstCents" >= 0);

DO $$ BEGIN
  ALTER TABLE "ResearchCirclePlan" DROP CONSTRAINT IF EXISTS "ResearchCirclePlan_price_nonneg";
  ALTER TABLE "ResearchCirclePlan" ADD CONSTRAINT "ResearchCirclePlan_price_nonneg" CHECK ("priceCents" >= 0);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
