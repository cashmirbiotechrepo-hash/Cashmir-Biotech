import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.adminUser.create({
    data: {
      email: "darmoalim@gmail.com",
      name: "Admin",
      role: "admin",
      active: true,
      passwordHash: "dummy",
    }
  });
  console.log("Created admin user darmoalim@gmail.com");
}

main().catch(console.error).finally(() => prisma.$disconnect());
