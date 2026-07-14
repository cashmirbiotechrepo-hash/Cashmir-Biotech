"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";
import { z } from "zod";
import { getCurrentAdmin, requireAdminSession } from "@/lib/auth";
import { countMediaUrlReferences } from "@/lib/admin/media-refs";
import { DESTRUCTIVE_ROLES, hasAdminRole } from "@/lib/admin/rbac";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import type { ActionState } from "./actions";

const updateSchema = z.object({
  id: z.string().min(1),
  altText: z.string().max(300).optional()
});

export async function updateMediaAssetAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid media details." };
  }

  await db.mediaAsset.update({
    where: { id: parsed.data.id },
    data: { altText: parsed.data.altText ?? "" }
  });

  await writeAuditLog({
    userEmail: String(admin.email),
    action: "update",
    entityType: "media_asset",
    entityId: parsed.data.id
  });

  revalidatePath("/admin/media");
  return { ok: true, message: "Alt text updated." };
}

export async function deleteMediaAssetAction(formData: FormData): Promise<ActionState> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Session expired." };
  if (!hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) {
    return { error: "You don't have permission to delete media." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing asset id." };

  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return { error: "Asset not found." };

  const refs = await countMediaUrlReferences(asset.url);
  if (refs > 0) {
    return {
      error: `This image is used in ${refs} place(s) on the site. Remove references before deleting.`
    };
  }

  if (asset.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", asset.url);
    await unlink(filePath).catch(() => undefined);
  }

  await db.mediaAsset.delete({ where: { id } });
  await writeAuditLog({
    userEmail: String(admin.email),
    action: "delete",
    entityType: "media_asset",
    entityId: id,
    diff: { url: asset.url }
  });

  revalidatePath("/admin/media");
  return { ok: true, message: "Asset deleted." };
}
