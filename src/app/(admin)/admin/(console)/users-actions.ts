"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { AdminAuthService } from "@/lib/admin/auth-service";
import { AdminPasswordService } from "@/lib/admin/password";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import type { ActionState } from "./actions";

const roleSchema = z.enum(["owner", "admin", "editor"]);

const createUserSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(10, "Password must be at least 10 characters."),
  role: roleSchema
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  active: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
    .transform((v) => v === "on" || v === "true")
    .optional()
});

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createAdminUserAction(formData: FormData): Promise<ActionState> {
  const actor = await requireAdminRole(["owner"]);
  const parsed = createUserSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid user details." };
  }

  const existing = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "An account with this email already exists." };

  const user = await db.adminUser.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: AdminPasswordService.hash(parsed.data.password),
      role: parsed.data.role
    }
  });

  await writeAuditLog({
    userEmail: String(actor.email),
    action: "create",
    entityType: "admin_user",
    entityId: user.id,
    diff: { email: user.email, role: user.role }
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Admin account created." };
}

export async function updateAdminUserAction(formData: FormData): Promise<ActionState> {
  const actor = await requireAdminRole(["owner"]);
  const parsed = updateUserSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid user details." };
  }

  const target = await db.adminUser.findUnique({ where: { id: parsed.data.id } });
  if (!target) return { error: "User not found." };

  const isSelf = actor.id === target.id;
  const demotingFromOwner = target.role === "owner" && parsed.data.role && parsed.data.role !== "owner";
  const deactivating = parsed.data.active === false;

  if (isSelf && demotingFromOwner) {
    return { error: "You cannot remove your own owner role." };
  }
  if (isSelf && deactivating) {
    return { error: "You cannot deactivate your own account." };
  }

  if ((demotingFromOwner || (deactivating && target.role === "owner")) && target.active) {
    const owners = await db.adminUser.count({ where: { role: "owner", active: true } });
    if (owners <= 1) return { error: "Cannot demote or deactivate the last active owner." };
  }

  await db.adminUser.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {})
    }
  });

  if (deactivating) {
    await AdminAuthService.revokeAllSessions(parsed.data.id);
  }

  await writeAuditLog({
    userEmail: String(actor.email),
    action: "update",
    entityType: "admin_user",
    entityId: parsed.data.id,
    diff: { role: parsed.data.role, active: parsed.data.active }
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "User updated." };
}

export async function toggleTwoFactorAction(formData: FormData): Promise<ActionState> {
  const actor = await requireAdminRole(["owner"]);
  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!id) return { error: "Missing user id." };

  await db.adminUser.update({
    where: { id },
    data: {
      isTwoFactorEnabled: enabled,
      twoFactorSecret: null,
      twoFactorExpires: null,
      twoFactorAttempts: 0
    }
  });

  await writeAuditLog({
    userEmail: String(actor.email),
    action: enabled ? "enable_2fa" : "disable_2fa",
    entityType: "admin_user",
    entityId: id
  });

  revalidatePath("/admin/users");
  return { ok: true, message: enabled ? "2FA enabled for user." : "2FA disabled for user." };
}

export async function unlockAdminUserAction(formData: FormData): Promise<ActionState> {
  const actor = await requireAdminRole(["owner"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing user id." };

  await db.adminUser.update({
    where: { id },
    data: { lockedUntil: null, failedLoginAttempts: 0 }
  });

  await writeAuditLog({
    userEmail: String(actor.email),
    action: "unlock",
    entityType: "admin_user",
    entityId: id
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Account unlocked." };
}

export async function revokeUserSessionsAction(formData: FormData): Promise<ActionState> {
  const actor = await requireAdminRole(["owner"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing user id." };

  await AdminAuthService.revokeAllSessions(id);
  await writeAuditLog({
    userEmail: String(actor.email),
    action: "revoke_sessions",
    entityType: "admin_user",
    entityId: id
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "All sessions revoked." };
}

export async function revokeSessionAction(formData: FormData): Promise<ActionState> {
  const actor = await requireAdminRole(["owner"]);
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return { error: "Missing session id." };

  await AdminAuthService.logout(sessionId, String(actor.email));
  await writeAuditLog({
    userEmail: String(actor.email),
    action: "revoke_session",
    entityType: "admin_session",
    entityId: sessionId
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Session revoked." };
}

export async function resetAdminPasswordAction(formData: FormData): Promise<ActionState> {
  const actor = await requireAdminRole(["owner"]);
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 10) {
    return { error: "Password must be at least 10 characters." };
  }

  await db.adminUser.update({
    where: { id },
    data: { passwordHash: AdminPasswordService.hash(password) }
  });
  await AdminAuthService.revokeAllSessions(id);

  await writeAuditLog({
    userEmail: String(actor.email),
    action: "reset_password",
    entityType: "admin_user",
    entityId: id
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Password reset. User must sign in again." };
}
