-- Phase 2: CRM, marketing, finance, patent depth

CREATE TYPE "PatentLifecycle" AS ENUM ('pending', 'granted', 'expired');
CREATE TYPE "ContactType" AS ENUM ('lead', 'customer', 'partner');
CREATE TYPE "DealStage" AS ENUM ('lead', 'qualified', 'proposal', 'won', 'lost');
CREATE TYPE "CouponType" AS ENUM ('percent', 'fixed');
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'sent');

ALTER TABLE "Product" ADD COLUMN "patentId" TEXT;
CREATE INDEX "Product_patentId_idx" ON "Product"("patentId");

ALTER TABLE "Patent" ADD COLUMN "applicationNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN "lifecycleStatus" "PatentLifecycle" NOT NULL DEFAULT 'granted',
ADD COLUMN "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN "documentUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "inventors" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "filedAt" TIMESTAMP(3),
ADD COLUMN "grantedAt" TIMESTAMP(3);

CREATE INDEX "Patent_lifecycleStatus_publishedAt_idx" ON "Patent"("lifecycleStatus", "publishedAt");

UPDATE "Patent" SET "applicationNumber" = "patentCode", "country" = "jurisdiction", "filedAt" = "publishedAt" WHERE "applicationNumber" = '';

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "type" "ContactType" NOT NULL DEFAULT 'lead',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'lead',
    "valueCents" INTEGER NOT NULL DEFAULT 0,
    "expectedCloseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "gstDetails" JSONB NOT NULL,
    "pdfUrl" TEXT NOT NULL DEFAULT '',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "gstCents" INTEGER NOT NULL DEFAULT 0,
    "vendor" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Contact_type_createdAt_idx" ON "Contact"("type", "createdAt");
CREATE INDEX "Deal_stage_expectedCloseAt_idx" ON "Deal"("stage", "expectedCloseAt");
CREATE INDEX "Deal_contactId_idx" ON "Deal"("contactId");
CREATE INDEX "Coupon_active_expiresAt_idx" ON "Coupon"("active", "expiresAt");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");
CREATE INDEX "Expense_incurredAt_idx" ON "Expense"("incurredAt");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

ALTER TABLE "Product" ADD CONSTRAINT "Product_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "Patent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
