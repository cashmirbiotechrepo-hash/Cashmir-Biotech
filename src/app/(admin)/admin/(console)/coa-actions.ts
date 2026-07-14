"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { hasAdminRole, OPERATIONS_ROLES } from "@/lib/admin/rbac";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import type { ActionState } from "./actions";

const coaSchema = z.object({
  productId: z.string().min(1),
  lotCode: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  fileUrl: z
    .string()
    .trim()
    .min(1)
    .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Upload a CoA PDF first"),
  issuedAt: z.string().optional()
});

export async function saveCertificateAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "Insufficient permissions." };
  }

  const parsed = coaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check CoA fields." };
  }

  const issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : new Date();
  const record = await db.certificateOfAnalysis.create({
    data: {
      productId: parsed.data.productId,
      lotCode: parsed.data.lotCode,
      title: parsed.data.title,
      fileUrl: parsed.data.fileUrl,
      issuedAt: Number.isNaN(issuedAt.getTime()) ? new Date() : issuedAt
    }
  });

  await writeAuditLog({
    userEmail: String(admin.email),
    action: "create",
    entityType: "certificate_of_analysis",
    entityId: record.id,
    diff: { lotCode: record.lotCode, productId: record.productId }
  });

  revalidatePath(`/admin/inventory/${parsed.data.productId}`);
  revalidatePath("/portal/documents");
  return { ok: true, message: `CoA ${record.lotCode} saved.` };
}

export async function deactivateCertificateAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "Insufficient permissions." };
  }
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!id) return { error: "Missing id." };

  await db.certificateOfAnalysis.update({ where: { id }, data: { active: false } });
  await writeAuditLog({
    userEmail: String(admin.email),
    action: "update",
    entityType: "certificate_of_analysis",
    entityId: id,
    diff: { active: false }
  });
  if (productId) revalidatePath(`/admin/inventory/${productId}`);
  return { ok: true, message: "CoA deactivated." };
}
