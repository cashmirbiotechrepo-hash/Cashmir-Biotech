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

const saveSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  active: z
    .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === "1")
});

export async function saveCategoryAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid category." };

  const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.name);
  if (!slug) return { error: "Slug cannot be empty." };

  const conflict = await db.category.findFirst({
    where: {
      slug,
      ...(parsed.data.id ? { NOT: { id: parsed.data.id } } : {})
    },
    select: { id: true }
  });
  if (conflict) return { error: `Slug “${slug}” is already in use.` };

  if (parsed.data.id) {
    const existing = await db.category.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return { error: "Category not found." };

    await db.category.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        slug,
        sortOrder: parsed.data.sortOrder,
        active: parsed.data.active
      }
    });
  } else {
    await db.category.create({
      data: {
        name: parsed.data.name,
        slug,
        sortOrder: parsed.data.sortOrder,
        active: parsed.data.active
      }
    });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { ok: true, message: `Saved ${parsed.data.name}.` };
}

export async function deleteCategoryAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing category." };

  const category = await db.category.findUnique({ where: { id } });
  if (!category) return { error: "Category not found." };

  const productCount = await db.product.count({ where: { category: category.name } });
  if (productCount > 0) {
    return {
      error: `Cannot delete — ${productCount} product${productCount === 1 ? "" : "s"} still use “${category.name}”. Reassign or hide them first.`
    };
  }

  await db.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { ok: true, message: `Deleted ${category.name}.` };
}

export async function duplicateCategoryAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing category." };

  const source = await db.category.findUnique({ where: { id } });
  if (!source) return { error: "Category not found." };

  const baseName = `${source.name} (copy)`.slice(0, 80);
  let slug = slugify(baseName);
  let attempt = 2;
  while (await db.category.findUnique({ where: { slug } })) {
    slug = `${slugify(source.name)}-copy-${attempt}`.slice(0, 80);
    attempt += 1;
    if (attempt > 50) return { error: "Could not allocate a unique slug." };
  }

  await db.category.create({
    data: {
      name: baseName,
      slug,
      sortOrder: source.sortOrder + 1,
      active: false
    }
  });

  revalidatePath("/admin/categories");
  return { ok: true, message: `Duplicated as ${baseName}.` };
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
