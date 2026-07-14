import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { createHmac } from "crypto";

/**
 * Resets (or creates) the bootstrap admin account with a known password,
 * hashed the same way AdminPasswordService does (HMAC pepper -> bcrypt).
 *
 * Usage:
 *   npx tsx scripts/reset-admin.ts
 *   ADMIN_RESET_PASSWORD="MyStrongPass!1" npx tsx scripts/reset-admin.ts
 *
 * The pepper falls back to the dev default in secrets.ts so the hash matches
 * a dev server that has no PASSWORD_PEPPER set. In production, set PASSWORD_PEPPER
 * in .env before running this so the hash matches the running app.
 */
const DEV_PEPPER = "dev-only-insecure-pepper-32chars!";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@cashmirbiotech.com").toLowerCase().trim();
  const password = process.env.ADMIN_RESET_PASSWORD || "CashmirBiotech@2026";
  const pepper = process.env.PASSWORD_PEPPER || DEV_PEPPER;

  const peppered = createHmac("sha256", pepper).update(password).digest("hex");
  const passwordHash = hashSync(peppered, 12);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isTwoFactorEnabled: false
    },
    create: {
      email,
      passwordHash,
      name: "Owner",
      role: "owner",
      isTwoFactorEnabled: false
    }
  });

  console.log("─".repeat(60));
  console.log(`[reset-admin] Account ready: ${user.email} (role: ${user.role})`);
  console.log(`[reset-admin] Login password: ${password}`);
  console.log(`[reset-admin] passwordHash (peppered bcrypt): ${passwordHash}`);
  console.log("─".repeat(60));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
