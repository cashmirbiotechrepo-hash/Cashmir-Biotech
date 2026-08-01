import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.adminUser.findMany({
    include: { accounts: true }
  });
  console.log(JSON.stringify(admins, null, 2));
}

main().finally(() => prisma.$disconnect());
