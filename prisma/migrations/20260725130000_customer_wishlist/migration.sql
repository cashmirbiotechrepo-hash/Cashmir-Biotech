-- Phase C: customer wishlist
CREATE TABLE IF NOT EXISTS "CustomerWishlistItem" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerWishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerWishlistItem_customerId_productId_key"
  ON "CustomerWishlistItem"("customerId", "productId");

CREATE INDEX IF NOT EXISTS "CustomerWishlistItem_customerId_createdAt_idx"
  ON "CustomerWishlistItem"("customerId", "createdAt");

ALTER TABLE "CustomerWishlistItem"
  ADD CONSTRAINT "CustomerWishlistItem_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerWishlistItem"
  ADD CONSTRAINT "CustomerWishlistItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
