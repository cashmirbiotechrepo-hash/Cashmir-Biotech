-- Phase D: address claim dismiss + notification prefs
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "addressClaimPromptDismissedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notifyOrderUpdates" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notifyMarketing" BOOLEAN NOT NULL DEFAULT false;
