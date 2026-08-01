-- Add CustomerAccount and AdminAccount OAuth link tables (Google OAuth phase 1)
-- Migration: 20260801090000_add_oauth_accounts

-- CustomerAccount: links OAuth provider identities to customers
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- AdminAccount: links OAuth provider identities to admin users (no auto-provision)
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "CustomerAccount_provider_providerAccountId_key" ON "CustomerAccount"("provider", "providerAccountId");
CREATE INDEX "CustomerAccount_customerId_idx" ON "CustomerAccount"("customerId");

CREATE UNIQUE INDEX "AdminAccount_provider_providerAccountId_key" ON "AdminAccount"("provider", "providerAccountId");
CREATE INDEX "AdminAccount_adminId_idx" ON "AdminAccount"("adminId");

-- Foreign keys
ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminAccount" ADD CONSTRAINT "AdminAccount_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
