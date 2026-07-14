"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin, requireAdminSession } from "@/lib/auth";
import { DESTRUCTIVE_ROLES, hasAdminRole } from "@/lib/admin/rbac";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import type { ActionState } from "./actions";

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post"
  );
}

const blogSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(120).optional(),
  excerpt: z.string().trim().max(500).optional(),
  coverImageUrl: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1),
  status: z.enum(["draft", "published"])
});

export async function saveBlogPostAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = blogSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the blog fields." };
  }

  const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
  const publishedAt = parsed.data.status === "published" ? new Date() : null;
  const excerpt = parsed.data.excerpt ?? "";
  const coverImageUrl = parsed.data.coverImageUrl ?? "";

  if (parsed.data.id) {
    const existing = await db.blogPost.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return { error: "Post not found." };

    const slugConflict = await db.blogPost.findFirst({
      where: { slug, NOT: { id: parsed.data.id } }
    });
    if (slugConflict) return { error: "Slug already in use." };

    await db.blogPost.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        slug,
        excerpt,
        coverImageUrl,
        body: parsed.data.body,
        status: parsed.data.status,
        publishedAt: parsed.data.status === "published" ? existing.publishedAt ?? publishedAt : null
      }
    });
  } else {
    const slugConflict = await db.blogPost.findUnique({ where: { slug } });
    if (slugConflict) return { error: "Slug already in use." };

    await db.blogPost.create({
      data: {
        title: parsed.data.title,
        slug,
        excerpt,
        coverImageUrl,
        body: parsed.data.body,
        status: parsed.data.status,
        publishedAt
      }
    });
  }

  await writeAuditLog({
    userEmail: String(admin.email),
    action: parsed.data.id ? "update" : "create",
    entityType: "blog_post",
    entityId: slug,
    diff: { title: parsed.data.title, status: parsed.data.status }
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  return { ok: true, message: parsed.data.id ? "Post saved." : "Post created." };
}

export async function deleteBlogPostAction(formData: FormData): Promise<ActionState> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Session expired." };
  if (!hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) {
    return { error: "You don't have permission to delete posts." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing post id." };

  const post = await db.blogPost.delete({ where: { id } }).catch(() => null);
  if (!post) return { error: "Post not found." };

  await writeAuditLog({
    userEmail: String(admin.email),
    action: "delete",
    entityType: "blog_post",
    entityId: id,
    diff: { title: post.title }
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  return { ok: true, message: "Post deleted." };
}
