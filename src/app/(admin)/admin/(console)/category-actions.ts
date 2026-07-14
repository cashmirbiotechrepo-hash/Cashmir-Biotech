"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { hasAdminRole, OPERATIONS_ROLES } from "@/lib/admin/rbac";
import { db } from "@/lib/db";
import type { ActionState } from "./actions";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
});

export async function saveCategoryAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid category." };

  const slug = slugify(parsed.data.name);
  await db.category.upsert({
    where: { slug },
    create: { name: parsed.data.name, slug, sortOrder: parsed.data.sortOrder },
    update: { name: parsed.data.name, sortOrder: parsed.data.sortOrder, active: true }
  });
  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { ok: true, message: `Saved ${parsed.data.name}.` };
}

export async function syncCategoriesFromProductsAction(): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };

  const rows = await db.product.findMany({
    where: { category: { not: "" } },
    distinct: ["category"],
    select: { category: true }
  });
  let n = 0;
  for (const row of rows) {
    const name = row.category.trim();
    if (!name) continue;
    const slug = slugify(name);
    await db.category.upsert({
      where: { slug },
      create: { name, slug },
      update: { name, active: true }
    });
    n += 1;
  }
  revalidatePath("/admin/categories");
  return { ok: true, message: `Synced ${n} categor${n === 1 ? "y" : "ies"} from products.` };
}
