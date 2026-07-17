-- CreateTable
CREATE TABLE "OrderRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "razorpayRefundId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "stockRestored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderRefund_amount_nonneg" CHECK ("amountCents" > 0)
);

CREATE UNIQUE INDEX "OrderRefund_razorpayRefundId_key" ON "OrderRefund"("razorpayRefundId");
CREATE INDEX "OrderRefund_orderId_idx" ON "OrderRefund"("orderId");

ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
