"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import { ensureInvoiceForOrder } from "@/modules/shop/services/order-ops.service";
import type { ActionState } from "./actions";

export async function ensureInvoiceForOrderAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order." };

  try {
    const result = await ensureInvoiceForOrder(orderId);
    if (!result.invoiceId) return { error: "Could not create invoice." };

    await writeAuditLog({
      userEmail: String(admin.email),
      action: result.created ? "create" : "view",
      entityType: "invoice",
      entityId: result.invoiceId,
      diff: { invoiceNumber: result.invoiceNumber, orderId, auto: true }
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/finance");
    return {
      ok: true,
      message: result.created
        ? `Invoice ${result.invoiceNumber} created.`
        : `Invoice ${result.invoiceNumber} already exists.`
    };
  } catch {
    return { error: "Couldn't generate invoice." };
  }
}
