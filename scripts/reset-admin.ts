import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { createHmac } from "crypto";

/**
 * Break-glass: resets (or creates) the bootstrap admin account.
 *
 * Usage (local / non-production):
 *   npm run db:reset-admin -- --  (see package.json)
 *   or:
 *   node --env-file=.env --import tsx scripts/reset-admin.ts
 *   with ADMIN_RESET_PASSWORD set in the environment.
 *
 * Example:
 *   $env:ADMIN_RESET_PASSWORD="CashmirBiotech@2026"; node --env-file=.env --import tsx scripts/reset-admin.ts
 *
 * Production requires:
 *   ALLOW_PROD_ADMIN_RESET=yes ADMIN_RESET_PASSWORD="…" …
 *
 * Uses PASSWORD_PEPPER from .env (required for hash to match the running app).
 * Disables 2FA so the owner can regain console access — re-enable after login.
 */
const DEV_PEPPER = "dev-only-insecure-pepper-32chars!";

const prisma = new PrismaClient();

function looksLikeProductionDatabase(url: string): boolean {
  const lower = (url || "").toLowerCase();
  if (!lower) return false;
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  if (lower.includes("cashmir_test") || lower.includes("@postgres:")) return false;
  return true;
}

async function main() {
  const isProdRuntime = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const dbUrl = process.env.DATABASE_URL ?? "";
  const targetingProdDb = looksLikeProductionDatabase(dbUrl);

  if ((isProdRuntime || targetingProdDb) && process.env.ALLOW_PROD_ADMIN_RESET !== "yes") {
    console.error(
      "[reset-admin] Refusing to run against a production-like environment.\n" +
        "Set ALLOW_PROD_ADMIN_RESET=yes and ADMIN_RESET_PASSWORD to a strong secret if this is intentional."
    );
    process.exit(1);
  }

  const email = (process.env.ADMIN_EMAIL || "admin@cashmirbiotech.com").toLowerCase().trim();
  const password = process.env.ADMIN_RESET_PASSWORD;
  if (!password || password.length < 12) {
    console.error(
      "[reset-admin] ADMIN_RESET_PASSWORD is required (min 12 characters). No default password is shipped."
    );
    process.exit(1);
  }

  const pepper =
    process.env.PASSWORD_PEPPER ||
    (!(isProdRuntime || targetingProdDb) ? DEV_PEPPER : "");
  if (!pepper) {
    console.error("[reset-admin] PASSWORD_PEPPER is required when resetting a production admin.");
    process.exit(1);
  }
  if (!process.env.PASSWORD_PEPPER) {
    console.warn(
      "[reset-admin] PASSWORD_PEPPER not set — using DEV_PEPPER. " +
        "Load .env so the hash matches the app: node --env-file=.env --import tsx scripts/reset-admin.ts"
    );
  }

  const peppered = createHmac("sha256", pepper).update(password).digest("hex");
  const passwordHash = hashSync(peppered, 12);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorExpires: null
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
  console.log(`[reset-admin] 2FA disabled — re-enable after first login.`);
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
