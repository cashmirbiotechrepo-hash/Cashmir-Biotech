"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin, requireAdminSession } from "@/lib/auth";
import { AdminAuthService } from "@/lib/admin/auth-service";
import { AdminPasswordService } from "@/lib/admin/password";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import type { ActionState } from "./actions";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "New password must be at least 10 characters.")
});

export async function changeOwnPasswordAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your password fields." };
  }

  const user = await db.adminUser.findUnique({ where: { id: admin.id } });
  if (!user) return { error: "Account not found." };

  if (!AdminPasswordService.verify(parsed.data.currentPassword, user.passwordHash)) {
    return { error: "Current password is incorrect." };
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: AdminPasswordService.hash(parsed.data.newPassword) }
  });

  // Invalidate other devices if this change was (or might be) a compromise response.
  if (admin.sessionId) {
    await AdminAuthService.revokeAllSessions(user.id, admin.sessionId);
  }

  await writeAuditLog({
    userEmail: String(admin.email),
    action: "change_password",
    entityType: "admin_user",
    entityId: user.id
  });

  return { ok: true, message: "Password updated successfully. Other sessions were signed out." };
}

export async function revokeMyOtherSessionsAction(): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!admin.sessionId) return { error: "No active session." };

  const sessions = await db.adminSession.findMany({
    where: { userId: admin.id, isRevoked: false }
  });

  for (const session of sessions) {
    if (session.id === admin.sessionId) continue;
    await AdminAuthService.logout(session.id, String(admin.email));
  }

  await writeAuditLog({
    userEmail: String(admin.email),
    action: "revoke_other_sessions",
    entityType: "admin_user",
    entityId: admin.id
  });

  revalidatePath("/admin/account");
  return { ok: true, message: "Signed out all other devices." };
}

export async function updateOwnProfileAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Display name is required." };

  await db.adminUser.update({
    where: { id: admin.id },
    data: { name }
  });

  await writeAuditLog({
    userEmail: String(admin.email),
    action: "update_profile",
    entityType: "admin_user",
    entityId: admin.id,
    diff: { name }
  });

  revalidatePath("/admin/account");
  return { ok: true, message: "Profile updated." };
}

export async function getOwnSessions() {
  const admin = await getCurrentAdmin();
  if (!admin) return [];

  return db.adminSession.findMany({
    where: { userId: admin.id, isRevoked: false, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" }
  });
}
