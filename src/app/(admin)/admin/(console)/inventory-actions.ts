"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { hasAdminRole, OPERATIONS_ROLES } from "@/lib/admin/rbac";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import { adjustStockManually, setOnHand } from "@/modules/admin/services/inventory.service";
import type { ActionState } from "./actions";

const adjustSchema = z.object({
  productId: z.string().min(1),
  mode: z.enum(["restock", "damaged", "set"]),
  quantity: z.coerce.number().int(),
  note: z.string().trim().max(2000).optional()
});

export async function adjustInventoryAction(formData: FormData): Promise<ActionState> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Session expired." };
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "You don't have permission to adjust inventory." };
  }

  const parsed = adjustSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the adjustment fields." };
  }
  const { productId, mode, quantity, note } = parsed.data;

  if (mode !== "set" && quantity <= 0) {
    return { error: "Enter a quantity greater than zero." };
  }
  if (mode === "set" && quantity < 0) {
    return { error: "Stock level can't be negative." };
  }

  try {
    const result =
      mode === "set"
        ? await setOnHand({ productId, target: quantity, note, createdBy: String(admin.email) })
        : await adjustStockManually({
            productId,
            delta: mode === "restock" ? quantity : -quantity,
            changeType: mode === "restock" ? "restock" : "damaged",
            note,
            createdBy: String(admin.email)
          });

    if (result && "ok" in result && result.ok === false) {
      return { error: result.error };
    }

    await writeAuditLog({
      userEmail: String(admin.email),
      action: "inventory_adjust",
      entityType: "inventory",
      entityId: productId,
      diff: { mode, quantity }
    });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
    revalidatePath("/admin/dashboard");
    return { ok: true, message: "Inventory updated." };
  } catch {
    return { error: "Couldn't update inventory." };
  }
}
