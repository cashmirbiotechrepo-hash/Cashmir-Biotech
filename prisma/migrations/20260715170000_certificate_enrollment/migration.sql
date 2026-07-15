-- Unlisted SKUAST-K collaborative short-course enrollments (/certificate)
CREATE TABLE IF NOT EXISTS "CertificateEnrollment" (
    "id" TEXT NOT NULL,
    "enrollmentNumber" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentPhone" TEXT NOT NULL DEFAULT '',
    "institution" TEXT NOT NULL DEFAULT '',
    "placeOfSupply" TEXT NOT NULL DEFAULT 'Jammu and Kashmir',
    "courseIds" JSONB NOT NULL,
    "courseLines" JSONB NOT NULL,
    "credits" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "gstDetails" JSONB NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "paymentOutcome" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CertificateEnrollment_enrollmentNumber_key" ON "CertificateEnrollment"("enrollmentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CertificateEnrollment_accessToken_key" ON "CertificateEnrollment"("accessToken");
CREATE UNIQUE INDEX IF NOT EXISTS "CertificateEnrollment_invoiceNumber_key" ON "CertificateEnrollment"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "CertificateEnrollment_status_idx" ON "CertificateEnrollment"("status");
CREATE INDEX IF NOT EXISTS "CertificateEnrollment_studentEmail_idx" ON "CertificateEnrollment"("studentEmail");
CREATE INDEX IF NOT EXISTS "CertificateEnrollment_razorpayOrderId_idx" ON "CertificateEnrollment"("razorpayOrderId");
CREATE INDEX IF NOT EXISTS "CertificateEnrollment_createdAt_idx" ON "CertificateEnrollment"("createdAt");
