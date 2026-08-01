import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";
import { compareSync } from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "CashmirBiotech@2026"; // the known password from .env comments

async function main() {
  const admins = await prisma.adminUser.findMany({
    select: { id: true, email: true, passwordHash: true, active: true }
  });

  console.log("\n=== Admin Users ===");
  for (const admin of admins) {
    console.log(`\nEmail: ${admin.email}`);
    console.log(`Active: ${admin.active}`);
    console.log(`Has hash: ${!!admin.passwordHash}`);
    
    // Test with the local .env PASSWORD_PEPPER
    const localPepper = process.env.PASSWORD_PEPPER;
    if (localPepper && admin.passwordHash) {
      const peppered = createHmac("sha256", localPepper).update(TEST_PASSWORD).digest("hex");
      const valid = compareSync(peppered, admin.passwordHash);
      console.log(`Password "${TEST_PASSWORD}" valid with LOCAL pepper: ${valid}`);
    }
    
    // Test without pepper (legacy)
    if (admin.passwordHash) {
      const legacyValid = compareSync(TEST_PASSWORD, admin.passwordHash);
      console.log(`Password valid WITHOUT pepper (legacy): ${legacyValid}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
