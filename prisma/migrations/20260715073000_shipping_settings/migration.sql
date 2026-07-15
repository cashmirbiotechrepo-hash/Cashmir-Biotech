-- Store-wide delivery fee defaults (admin-editable).
ALTER TABLE "SiteSettings"
ADD COLUMN IF NOT EXISTS "flatShippingInr" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "SiteSettings"
ADD COLUMN IF NOT EXISTS "freeShippingThresholdInr" INTEGER NOT NULL DEFAULT 999;
