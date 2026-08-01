/**
 * Resets the active admin account password using the current PASSWORD_PEPPER env var.
 * Run with your PRODUCTION pepper set:
 *
 *   $env:DATABASE_URL="..."; $env:PASSWORD_PEPPER="your-amplify-pepper"; node --env-file=.env --import tsx scripts/reset-active-admin-password.ts
 */
import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

const NEW_PASSWORD = process.env.RESET_PASSWORD ?? "CashmirBiotech@2026";
const PEPPER = process.env.PASSWORD_PEPPER;

async function main() {
  if (!PEPPER) {
    console.error("❌ PASSWORD_PEPPER env var is required.");
    process.exit(1);
  }

  const peppered = createHmac("sha256", PEPPER).update(NEW_PASSWORD).digest("hex");
  const hash = hashSync(peppered, 12);

  // Update the active owner account
  const result = await prisma.adminUser.updateMany({
    where: { active: true, role: "owner" },
    data: { passwordHash: hash, failedLoginAttempts: 0, lockedUntil: null }
  });

  console.log(`✅ Updated ${result.count} admin account(s).`);
  console.log(`   Email:    cashmirbiotech@gmail.com`);
  console.log(`   Password: ${NEW_PASSWORD}`);
  console.log(`   Pepper:   ${PEPPER.slice(0, 8)}...`);
}

main().finally(() => prisma.$disconnect());
