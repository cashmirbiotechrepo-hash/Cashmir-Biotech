"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin, requireAdminSession } from "@/lib/auth";
import { DESTRUCTIVE_ROLES, hasAdminRole } from "@/lib/admin/rbac";
import { sendAdminMail } from "@/lib/admin/mail";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import {
  inventorsToText,
  nextInvoiceNumber,
  parseInventors
} from "@/modules/admin/services/phase2.service";
import {
  campaignSchema,
  contactSchema,
  couponSchema,
  dealSchema,
  expenseSchema,
  invoiceFromOrderSchema,
  patentFullSchema
} from "@/modules/admin/validations/phase2";
import type { ActionState } from "./actions";

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function parseDate(value: string | undefined) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidatePhase2() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/patents");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/marketing");
  revalidatePath("/admin/finance");
  revalidatePath("/patents");
}

export async function savePatentFullAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = patentFullSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check patent fields." };
  }
  const data = parsed.data;
  const linkedIds = (data.linkedProductIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const baseData = {
    title: data.title,
    summary: data.summary,
    status: data.status,
    lifecycleStatus: data.lifecycleStatus,
    patentCode: data.patentCode,
    applicationNumber: data.applicationNumber || data.patentCode,
    jurisdiction: data.jurisdiction,
    country: data.country || data.jurisdiction,
    imageUrl: data.imageUrl,
    documentUrl: data.documentUrl ?? "",
    inventors: parseInventors(data.inventors),
    filedAt: parseDate(data.filedAt),
    grantedAt: parseDate(data.grantedAt)
  };

  try {
    const patentId = await db.$transaction(async (tx) => {
      let id: string;
      if (data.id) {
        const updated = await tx.patent.update({
          where: { id: data.id },
          data: { ...baseData, publishedAt: parseDate(data.publishedAt) ?? undefined }
        });
        id = updated.id;
      } else {
        const created = await tx.patent.create({
          data: { ...baseData, publishedAt: parseDate(data.publishedAt) ?? new Date() }
        });
        id = created.id;
      }
      await tx.product.updateMany({ where: { patentId: id }, data: { patentId: null } });
      if (linkedIds.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: linkedIds } },
          data: { patentId: id }
        });
      }
      return id;
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: data.id ? "update" : "create",
      entityType: "patent",
      entityId: patentId,
      diff: { title: data.title, lifecycleStatus: data.lifecycleStatus }
    });
    revalidatePhase2();
    return { ok: true, message: data.id ? `Saved “${data.title}”.` : `Created “${data.title}”.` };
  } catch (error) {
    logger.error({ err: error, event: "patent_full_save_failed" }, "patent save failed");
    return { error: "Couldn't save this patent — the patent code may already exist." };
  }
}

export async function deletePatentAction(formData: FormData): Promise<ActionState> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Session expired." };
  if (!hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) {
    return { error: "You don't have permission to delete patents." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing patent id." };
  try {
    await db.$transaction(async (tx) => {
      await tx.product.updateMany({ where: { patentId: id }, data: { patentId: null } });
      await tx.patent.delete({ where: { id } });
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "patent",
      entityId: id
    });
    revalidatePhase2();
    return { ok: true, message: "Patent deleted." };
  } catch (error) {
    logger.error({ err: error, event: "patent_delete_failed" }, "patent delete failed");
    return { error: "Couldn't delete this patent." };
  }
}

export async function saveContactAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = contactSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check contact fields." };
  }
  const { id, email, company, phone, notes, ...rest } = parsed.data;
  try {
    const record = id
      ? await db.contact.update({
          where: { id },
          data: {
            ...rest,
            email: email || null,
            company: company ?? "",
            phone: phone ?? "",
            notes: notes ?? ""
          }
        })
      : await db.contact.create({
          data: {
            ...rest,
            email: email || null,
            company: company ?? "",
            phone: phone ?? "",
            notes: notes ?? ""
          }
        });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: id ? "update" : "create",
      entityType: "contact",
      entityId: record.id,
      diff: { name: rest.name, type: rest.type }
    });
    revalidatePath("/admin/crm");
    return { ok: true, message: `Saved ${rest.name}.` };
  } catch (error) {
    logger.error({ err: error, event: "contact_save_failed" }, "contact save failed");
    return { error: "Couldn't save contact." };
  }
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const admin = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.contact.delete({ where: { id } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "contact",
      entityId: id
    });
    revalidatePath("/admin/crm");
  } catch {
    // no-op; page revalidates on next navigation
  }
}

export async function deleteDealAction(formData: FormData): Promise<void> {
  const admin = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.deal.delete({ where: { id } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "deal",
      entityId: id
    });
    revalidatePath("/admin/crm");
  } catch {
    // no-op
  }
}

export async function saveDealAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = dealSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check deal fields." };
  }
  const { id, ...data } = parsed.data;
  const valueCents = data.valueCents * 100;
  try {
    const record = id
      ? await db.deal.update({
          where: { id },
          data: { ...data, valueCents, expectedCloseAt: parseDate(data.expectedCloseAt) }
        })
      : await db.deal.create({
          data: { ...data, valueCents, expectedCloseAt: parseDate(data.expectedCloseAt) }
        });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: id ? "update" : "create",
      entityType: "deal",
      entityId: record.id,
      diff: { title: data.title, stage: data.stage }
    });
    revalidatePath("/admin/crm");
    return { ok: true, message: `Saved “${data.title}”.` };
  } catch (error) {
    logger.error({ err: error, event: "deal_save_failed" }, "deal save failed");
    return { error: "Couldn't save deal." };
  }
}

export async function saveCouponAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const raw = fields(formData);
  const parsed = couponSchema.safeParse({
    ...raw,
    maxUses: raw.maxUses === "" ? "" : raw.maxUses
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check coupon fields." };
  }
  const { id, maxUses, expiresAt, ...data } = parsed.data;
  try {
    const record = id
      ? await db.coupon.update({
          where: { id },
          data: {
            ...data,
            maxUses: typeof maxUses === "number" ? maxUses : null,
            expiresAt: parseDate(expiresAt)
          }
        })
      : await db.coupon.create({
          data: {
            ...data,
            maxUses: typeof maxUses === "number" ? maxUses : null,
            expiresAt: parseDate(expiresAt)
          }
        });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: id ? "update" : "create",
      entityType: "coupon",
      entityId: record.id,
      diff: { code: data.code }
    });
    revalidatePath("/admin/marketing");
    return { ok: true, message: `Saved coupon ${data.code}.` };
  } catch (error) {
    logger.error({ err: error, event: "coupon_save_failed" }, "coupon save failed");
    return { error: "Couldn't save coupon — code may already exist." };
  }
}

export async function deleteCouponAction(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.coupon.delete({ where: { id } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "coupon",
      entityId: id
    });
    revalidatePath("/admin/marketing");
  } catch {
    // no-op
  }
}

export async function toggleCouponAction(formData: FormData): Promise<void> {
  const admin = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  try {
    await db.coupon.update({ where: { id }, data: { active } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update",
      entityType: "coupon",
      entityId: id,
      diff: { active }
    });
    revalidatePath("/admin/marketing");
  } catch {
    // no-op
  }
}

export async function saveExpenseAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const raw = fields(formData);
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check expense fields." };
  }
  const id = typeof raw.id === "string" && raw.id ? raw.id : undefined;
  const data = {
    title: parsed.data.title,
    category: parsed.data.category,
    amountCents: parsed.data.amountCents * 100,
    gstCents: parsed.data.gstCents * 100,
    vendor: parsed.data.vendor ?? "",
    notes: parsed.data.notes ?? "",
    incurredAt: parseDate(parsed.data.incurredAt) ?? new Date()
  };
  try {
    const record = id
      ? await db.expense.update({ where: { id }, data })
      : await db.expense.create({ data });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: id ? "update" : "create",
      entityType: "expense",
      entityId: record.id,
      diff: { title: parsed.data.title, amountCents: parsed.data.amountCents }
    });
    revalidatePath("/admin/finance");
    return { ok: true, message: id ? "Expense updated." : "Expense logged." };
  } catch (error) {
    logger.error({ err: error, event: "expense_save_failed" }, "expense save failed");
    return { error: "Couldn't save expense." };
  }
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin || !hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.expense.delete({ where: { id } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "expense",
      entityId: id
    });
    revalidatePath("/admin/finance");
  } catch {
    // no-op
  }
}

export async function createInvoiceAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = invoiceFromOrderSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice request." };
  }
  try {
    const order = await db.order.findUnique({
      where: { id: parsed.data.orderId },
      include: { items: true }
    });
    if (!order) return { error: "Order not found." };

    const subtotal = order.subtotalCents || order.totalCents;
    const tax = order.taxCents || Math.round(subtotal * 0.18);
    const total = order.totalCents || subtotal + tax;
    const half = Math.round(tax / 2);

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(),
        orderId: order.id,
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: total,
        gstDetails: {
          gstin: parsed.data.gstin ?? "",
          placeOfSupply: parsed.data.placeOfSupply,
          taxType: "intra",
          cgstCents: half,
          sgstCents: half,
          igstCents: 0,
          lineItems: order.items.map((item) => ({
            description: item.productName,
            qty: item.quantity,
            rateCents: item.unitPriceCents,
            amountCents: item.quantity * item.unitPriceCents
          }))
        }
      }
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "create",
      entityType: "invoice",
      entityId: invoice.id,
      diff: { invoiceNumber: invoice.invoiceNumber, orderId: order.id }
    });
    revalidatePath("/admin/finance");
    return { ok: true, message: `Invoice ${invoice.invoiceNumber} created.` };
  } catch (error) {
    logger.error({ err: error, event: "invoice_create_failed" }, "invoice create failed");
    return { error: "Couldn't create invoice." };
  }
}

export async function saveCampaignAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = campaignSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check campaign fields." };
  }
  const { id, ...data } = parsed.data;
  try {
    const record = id
      ? await db.emailCampaign.update({ where: { id }, data })
      : await db.emailCampaign.create({ data });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: id ? "update" : "create",
      entityType: "email_campaign",
      entityId: record.id,
      diff: { name: data.name }
    });
    revalidatePath("/admin/marketing");
    return { ok: true, message: `Saved campaign “${data.name}”.` };
  } catch (error) {
    logger.error({ err: error, event: "campaign_save_failed" }, "campaign save failed");
    return { error: "Couldn't save campaign." };
  }
}

export async function sendCampaignAction(formData: FormData): Promise<void> {
  const admin = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    const campaign = await db.emailCampaign.findUnique({ where: { id } });
    if (!campaign || campaign.status === "sent") return;

    const recipients = await db.subscriber.findMany({
      where: { status: "subscribed" },
      select: { email: true }
    });

    let delivered = 0;
    const unsubscribeHint =
      "\n\n———\nTo unsubscribe from Cashmir Biotech emails, reply with UNSUBSCRIBE or write to support@cashmirbiotech.com.";

    for (const recipient of recipients) {
      const ok = await sendAdminMail({
        to: recipient.email,
        subject: campaign.subject,
        text: `${campaign.body}${unsubscribeHint}`
      });
      if (ok) delivered += 1;
      // Light throttle to reduce SMTP rate-limit / spam-flag risk
      await new Promise((r) => setTimeout(r, 75));
    }

    await db.emailCampaign.update({
      where: { id },
      data: {
        status: "sent",
        recipientCount: delivered,
        sentAt: new Date()
      }
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "send",
      entityType: "email_campaign",
      entityId: id,
      diff: { recipients: recipients.length, delivered }
    });
    revalidatePath("/admin/marketing");
  } catch (error) {
    logger.error({ err: error, event: "campaign_send_failed" }, "campaign send failed");
  }
}

/** Re-export helper for patent editor default values */
export { inventorsToText };
