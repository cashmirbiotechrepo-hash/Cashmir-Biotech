"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { createOrRestockLot } from "@/modules/admin/services/inventory-lots.service";

const schema = z.object({
  productId: z.string().min(1),
  lotCode: z.string().trim().min(2).max(64),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  expiresAt: z.string().optional(),
  notes: z.string().max(500).optional()
});

export async function createInventoryLotAction(formData: FormData) {
  await requireAdminSession();
  const parsed = schema.safeParse({
    productId: formData.get("productId"),
    lotCode: formData.get("lotCode"),
    quantity: formData.get("quantity"),
    expiresAt: formData.get("expiresAt") || undefined,
    notes: formData.get("notes") || undefined
  });
  if (!parsed.success) throw new Error("Invalid lot form");

  await createOrRestockLot({
    productId: parsed.data.productId,
    lotCode: parsed.data.lotCode,
    quantity: parsed.data.quantity,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    notes: parsed.data.notes
  });

  revalidatePath(`/admin/inventory/${parsed.data.productId}`);
  revalidatePath("/admin/inventory");
}
