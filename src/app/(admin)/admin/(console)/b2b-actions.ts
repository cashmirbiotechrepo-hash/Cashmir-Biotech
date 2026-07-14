"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { hasAdminRole, OPERATIONS_ROLES } from "@/lib/admin/rbac";
import { db } from "@/lib/db";
import type { ActionState } from "./actions";

const orgSchema = z.object({
  name: z.string().trim().min(1).max(160),
  gstin: z.string().trim().max(20).optional().default(""),
  billingEmail: z.union([z.string().trim().email(), z.literal("")]).optional().default("")
});

const quoteSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  totalInr: z.coerce.number().min(0),
  poNumber: z.string().trim().max(80).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

export async function saveOrganizationAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };
  const parsed = orgSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid organisation." };

  await db.organization.create({
    data: {
      name: parsed.data.name,
      gstin: parsed.data.gstin || "",
      billingEmail: parsed.data.billingEmail || ""
    }
  });
  revalidatePath("/admin/b2b");
  return { ok: true, message: `Organisation “${parsed.data.name}” created.` };
}

export async function saveQuoteAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };
  const parsed = quoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };

  await db.quote.create({
    data: {
      organizationId: parsed.data.organizationId,
      title: parsed.data.title,
      totalCents: Math.round(parsed.data.totalInr * 100),
      poNumber: parsed.data.poNumber || "",
      notes: parsed.data.notes || "",
      status: "draft"
    }
  });
  revalidatePath("/admin/b2b");
  return { ok: true, message: "Quote saved." };
}

const inviteSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().trim().email(),
  role: z.enum(["buyer", "admin"]).default("buyer")
});

export async function inviteOrgMemberAdminAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) return { error: "Insufficient permissions." };
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid invite." };

  const { createOrganizationInvite } = await import("@/modules/shop/services/org-invite.service");
  const result = await createOrganizationInvite({
    organizationId: parsed.data.organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: admin.email
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/b2b");
  return {
    ok: true,
    message: result.mailed
      ? `Invite emailed to ${parsed.data.email}.`
      : `Invite created for ${parsed.data.email} (SMTP not configured — share link from ops logs).`
  };
}
