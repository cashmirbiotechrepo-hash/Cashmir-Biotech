import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/admin/account-settings";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getOwnSessions } from "@/app/(admin)/admin/(console)/account-actions";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Account settings" };

export default async function AdminAccountPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const [user, sessions] = await Promise.all([
    db.adminUser.findUnique({
      where: { id: admin.id },
      select: { name: true, email: true, role: true, isTwoFactorEnabled: true }
    }),
    getOwnSessions()
  ]);

  if (!user) redirect("/admin/login");

  return (
    <>
      <AdminPageHeader
        title="Account"
        description="Manage your profile, password, and active sessions."
      />
      {user.isTwoFactorEnabled ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Two-factor authentication is enabled on your account (managed by an owner).
        </p>
      ) : null}
      <AccountSettings
        email={user.email}
        name={user.name}
        role={user.role}
        sessionId={admin.sessionId}
        sessions={sessions}
      />
    </>
  );
}
