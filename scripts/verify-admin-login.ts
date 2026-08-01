import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";
import { compareSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pepper = process.env.PASSWORD_PEPPER!;
  const password = "CashmirBiotech@2026";
  
  const admin = await prisma.adminUser.findUnique({
    where: { email: "cashmirbiotech@gmail.com" },
    select: { email: true, active: true, passwordHash: true }
  });
  
  if (!admin) { console.error("Admin not found"); return; }
  
  const peppered = createHmac("sha256", pepper).update(password).digest("hex");
  const valid = compareSync(peppered, admin.passwordHash);
  
  console.log(`Email:    ${admin.email}`);
  console.log(`Active:   ${admin.active}`);
  console.log(`Password valid: ${valid}`);
  console.log(valid ? "✅ Login will work!" : "❌ Still wrong — hash mismatch");
}

main().finally(() => prisma.$disconnect());
