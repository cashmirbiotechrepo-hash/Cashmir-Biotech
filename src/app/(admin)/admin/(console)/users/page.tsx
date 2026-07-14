
import { UsersModule } from "@/components/admin/users-module";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Admin users" };

export default async function AdminUsersPage() {
  await requireAdminRole(["owner"]);

  const users = await db.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      sessions: {
        where: { isRevoked: false },
        orderBy: { lastUsedAt: "desc" }
      }
    }
  });

  return (
    <>
      <AdminPageHeader
        title="Admin users"
        description="Manage console accounts, roles, two-factor authentication, and active sessions."
      />
      <UsersModule users={users} />
    </>
  );
}
