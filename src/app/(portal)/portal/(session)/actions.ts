"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/customer/auth";
import { db } from "@/lib/db";
import { getSupportTicketRatelimit } from "@/lib/rate-limit-edge";

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Home"),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(4).max(12),
  country: z.string().trim().min(1).max(80).default("India"),
  isDefault: z.boolean().optional().default(false)
});

export type PortalAddressState = { ok?: true; error?: string };

export async function savePortalAddress(
  _prev: PortalAddressState,
  formData: FormData
): Promise<PortalAddressState> {
  const customer = await requireCustomerSession();
  const parsed = addressSchema.safeParse({
    label: formData.get("label") || "Home",
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || "",
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country") || "India",
    isDefault: formData.get("isDefault") === "on"
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check address fields and try again." };
  }

  if (parsed.data.isDefault) {
    await db.customerAddress.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false }
    });
  }

  await db.customerAddress.create({
    data: { customerId: customer.id, ...parsed.data }
  });

  revalidatePath("/portal/addresses");
  return { ok: true };
}

export async function deletePortalAddress(addressId: string) {
  const customer = await requireCustomerSession();
  await db.customerAddress.deleteMany({ where: { id: addressId, customerId: customer.id } });
  revalidatePath("/portal/addresses");
}

export async function setDefaultPortalAddress(addressId: string) {
  const customer = await requireCustomerSession();
  await db.$transaction(async (tx) => {
    const owned = await tx.customerAddress.findFirst({ where: { id: addressId, customerId: customer.id } });
    if (!owned) return;
    await tx.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    await tx.customerAddress.update({ where: { id: addressId }, data: { isDefault: true } });
  });
  revalidatePath("/portal/addresses");
}

export async function createSupportTicket(
  _prev: PortalAddressState,
  formData: FormData
): Promise<PortalAddressState> {
  const customer = await requireCustomerSession();
  const rl = getSupportTicketRatelimit();
  if (rl) {
    const { success } = await rl.limit(`portal:${customer.id}`);
    if (!success) {
      return { error: "Too many tickets submitted recently. Please wait a minute." };
    }
  }

  const topic = String(formData.get("topic") ?? "").trim().slice(0, 40);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 160);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const orderNumber = String(formData.get("orderNumber") ?? "").trim().slice(0, 40);
  if (!topic || !subject || body.length < 10) {
    return { error: "Add a topic, subject, and message (at least 10 characters)." };
  }

  await db.supportTicket.create({
    data: {
      customerId: customer.id,
      topic,
      subject,
      body,
      orderNumber
    }
  });

  const { buildSupportTicketMail } = await import("@/lib/email/transactional");
  const { sendTransactionalMail } = await import("@/lib/admin/mail");
  const { SITE_CONTACT } = await import("@/lib/site-contact");
  const mail = buildSupportTicketMail({
    subject: `[Portal] ${subject}`,
    fromEmail: customer.email,
    body: [`Topic: ${topic}`, `Order: ${orderNumber || "—"}`, "", body].join("\n")
  });
  await sendTransactionalMail({
    to: SITE_CONTACT.supportEmail || SITE_CONTACT.primaryEmail,
    mail
  }).catch(() => undefined);

  revalidatePath("/portal/support");
  return { ok: true };
}

export async function revokePortalSession(sessionId: string) {
  const customer = await requireCustomerSession();
  if (sessionId === customer.sessionId) return;
  await db.customerSession.updateMany({
    where: { id: sessionId, customerId: customer.id },
    data: { isRevoked: true }
  });
  const { markSessionRevokedEdge } = await import("@/lib/session-revoke-edge");
  await markSessionRevokedEdge(sessionId).catch(() => undefined);
  revalidatePath("/portal/security");
}
