-- Deduplicate post_payment tasks before adding unique constraint.
DELETE FROM "OrderTask" a
USING "OrderTask" b
WHERE a.id > b.id
  AND a."orderId" = b."orderId"
  AND a.type = b.type;

CREATE UNIQUE INDEX "OrderTask_orderId_type_key" ON "OrderTask"("orderId", "type");
