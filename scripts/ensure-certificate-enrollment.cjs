/**
 * Idempotent CREATE for CertificateEnrollment (Amplify bake + local ops).
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[ensure-certificate] DATABASE_URL missing — skip");
    return;
  }
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`
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
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CertificateEnrollment_enrollmentNumber_key" ON "CertificateEnrollment"("enrollmentNumber")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CertificateEnrollment_accessToken_key" ON "CertificateEnrollment"("accessToken")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CertificateEnrollment_invoiceNumber_key" ON "CertificateEnrollment"("invoiceNumber")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CertificateEnrollment_status_idx" ON "CertificateEnrollment"("status")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CertificateEnrollment_studentEmail_idx" ON "CertificateEnrollment"("studentEmail")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CertificateEnrollment_razorpayOrderId_idx" ON "CertificateEnrollment"("razorpayOrderId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CertificateEnrollment_createdAt_idx" ON "CertificateEnrollment"("createdAt")`
    );
    console.log("[ensure-certificate] CertificateEnrollment table ready");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.warn("[ensure-certificate] failed:", err?.message || err);
  process.exit(process.env.FAIL_ON_ERROR === "1" ? 1 : 0);
});
