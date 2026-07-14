-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "lotCodes" TEXT NOT NULL DEFAULT '';

-- Ensure CoA exists (was added in schema historically without a CREATE migration)
CREATE TABLE IF NOT EXISTS "CertificateOfAnalysis" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lotId" TEXT,
    CONSTRAINT "CertificateOfAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CertificateOfAnalysis_productId_active_idx" ON "CertificateOfAnalysis"("productId", "active");
CREATE INDEX IF NOT EXISTS "CertificateOfAnalysis_lotCode_idx" ON "CertificateOfAnalysis"("lotCode");

DO $$ BEGIN
  ALTER TABLE "CertificateOfAnalysis" ADD CONSTRAINT "CertificateOfAnalysis_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "CertificateOfAnalysis" ADD COLUMN IF NOT EXISTS "lotId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryLot" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "manufacturedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrderItemLotAllocation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemLotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ResearchCirclePlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 12,
    "benefits" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCirclePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ResearchCircleSubscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "razorpayPaymentId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCircleSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationInvite_tokenHash_key" ON "OrganizationInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "OrganizationInvite_organizationId_email_idx" ON "OrganizationInvite"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "OrganizationInvite_email_idx" ON "OrganizationInvite"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryLot_inventoryId_lotCode_key" ON "InventoryLot"("inventoryId", "lotCode");
CREATE INDEX IF NOT EXISTS "InventoryLot_inventoryId_expiresAt_idx" ON "InventoryLot"("inventoryId", "expiresAt");
CREATE INDEX IF NOT EXISTS "InventoryLot_lotCode_idx" ON "InventoryLot"("lotCode");

CREATE INDEX IF NOT EXISTS "OrderItemLotAllocation_orderItemId_idx" ON "OrderItemLotAllocation"("orderItemId");
CREATE INDEX IF NOT EXISTS "OrderItemLotAllocation_lotId_idx" ON "OrderItemLotAllocation"("lotId");

CREATE UNIQUE INDEX IF NOT EXISTS "ResearchCirclePlan_slug_key" ON "ResearchCirclePlan"("slug");
CREATE INDEX IF NOT EXISTS "ResearchCirclePlan_active_idx" ON "ResearchCirclePlan"("active");

CREATE INDEX IF NOT EXISTS "ResearchCircleSubscription_customerId_status_idx" ON "ResearchCircleSubscription"("customerId", "status");
CREATE INDEX IF NOT EXISTS "ResearchCircleSubscription_planId_idx" ON "ResearchCircleSubscription"("planId");
CREATE INDEX IF NOT EXISTS "ResearchCircleSubscription_currentPeriodEnd_idx" ON "ResearchCircleSubscription"("currentPeriodEnd");

CREATE INDEX IF NOT EXISTS "CertificateOfAnalysis_lotId_idx" ON "CertificateOfAnalysis"("lotId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_inventoryId_fkey"
    FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItemLotAllocation" ADD CONSTRAINT "OrderItemLotAllocation_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItemLotAllocation" ADD CONSTRAINT "OrderItemLotAllocation_lotId_fkey"
    FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CertificateOfAnalysis" ADD CONSTRAINT "CertificateOfAnalysis_lotId_fkey"
    FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ResearchCircleSubscription" ADD CONSTRAINT "ResearchCircleSubscription_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ResearchCircleSubscription" ADD CONSTRAINT "ResearchCircleSubscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "ResearchCirclePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
