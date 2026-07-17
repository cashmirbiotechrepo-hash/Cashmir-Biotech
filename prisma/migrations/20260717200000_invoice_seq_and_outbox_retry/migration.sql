-- Project Omega CRIT-02: atomic GST invoice numbering
CREATE SEQUENCE IF NOT EXISTS invoice_seq
  START WITH 1001
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Align sequence with existing FY invoices when migrating live data.
-- setval(..., false) means the next nextval() returns the given value.
SELECT setval(
  'invoice_seq',
  GREATEST(
    1001,
    COALESCE(
      (
        SELECT COUNT(*)::bigint
        FROM "Invoice"
        WHERE "issuedAt" >= date_trunc('year', CURRENT_DATE)
      ),
      0
    ) + 1
  ),
  false
);

-- Project Omega HIGH #1: outbox exponential backoff column (idempotent)
ALTER TABLE "OrderTask" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Project Omega HIGH-03: reject zero/negative refund amounts at the storage layer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderRefund_amount_nonneg'
  ) THEN
    ALTER TABLE "OrderRefund"
      ADD CONSTRAINT "OrderRefund_amount_nonneg" CHECK ("amountCents" > 0);
  END IF;
END $$;
