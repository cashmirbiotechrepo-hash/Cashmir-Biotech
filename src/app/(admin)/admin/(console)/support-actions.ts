"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { hasAdminRole, OPERATIONS_ROLES } from "@/lib/admin/rbac";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import type { ActionState } from "./actions";

export async function updateSupportTicketStatusAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "Insufficient permissions." };
  }
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !["open", "in_progress", "resolved", "closed"].includes(status)) {
    return { error: "Invalid ticket status." };
  }

  await db.supportTicket.update({ where: { id }, data: { status } });
  await writeAuditLog({
    userEmail: String(admin.email),
    action: "update",
    entityType: "support_ticket",
    entityId: id,
    diff: { status }
  });
  revalidatePath("/admin/support");
  return { ok: true, message: `Ticket marked ${status}.` };
}
