"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logoutCustomer, requireCustomerSession } from "@/lib/customer/auth";
import { db } from "@/lib/db";
import { getSupportTicketRatelimit } from "@/lib/rate-limit-edge";
import { parseIndianMobile } from "@/lib/customer/phone-in";
import {
  deleteOwnedAddress,
  setOwnedDefaultAddress,
  updatePortalAddressFields,
  upsertCustomerAddress
} from "@/lib/customer/addresses";
import { removeWishlistItem, toggleWishlistItem } from "@/lib/customer/wishlist";
import {
  confirmAddressClaim,
  dismissAddressClaimPrompt
} from "@/lib/customer/address-claim";

function resolveAddressLabel(preset: string, custom: string): string | { error: string } {
  const p = preset.trim();
  if (p === "Other") {
    const c = custom.trim();
    if (!c) return { error: "Enter a custom label for “Other”." };
    if (c.length > 40) return { error: "Label must be 40 characters or fewer." };
    return c;
  }
  if (p === "Home" || p === "Work") return p;
  const fallback = (p || custom).trim();
  if (!fallback) return { error: "Label is required." };
  return fallback.slice(0, 40);
}

const addressFieldsSchema = z.object({
  labelPreset: z.string().trim().optional(),
  labelCustom: z.string().trim().optional(),
  label: z.string().trim().optional(),
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
export type PortalProfileState = { ok?: true; error?: string };

export async function updateCustomerProfileAction(
  _prev: PortalProfileState,
  formData: FormData
): Promise<PortalProfileState> {
  const customer = await requireCustomerSession();
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!name || name.length > 120) {
    return { error: "Enter your full name." };
  }
  const phone = parseIndianMobile(phoneRaw);
  if (!phone.ok) return { error: phone.error };

  await db.customer.update({
    where: { id: customer.id },
    data: { name, phone: phone.digits }
  });

  revalidatePath("/portal/account");
  revalidatePath("/portal");
  return { ok: true };
}

export async function savePortalAddress(
  _prev: PortalAddressState,
  formData: FormData
): Promise<PortalAddressState> {
  const customer = await requireCustomerSession();
  const parsed = addressFieldsSchema.safeParse({
    labelPreset: formData.get("labelPreset") || undefined,
    labelCustom: formData.get("labelCustom") || "",
    label: formData.get("label") || undefined,
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

  const phone = parseIndianMobile(parsed.data.phone);
  if (!phone.ok) return { error: phone.error };

  const label = resolveAddressLabel(
    parsed.data.labelPreset || parsed.data.label || "Home",
    parsed.data.labelCustom || ""
  );
  if (typeof label === "object") return label;

  try {
    await upsertCustomerAddress(
      customer.id,
      {
        label,
        fullName: parsed.data.fullName,
        phone: phone.digits,
        line1: parsed.data.line1,
        line2: parsed.data.line2,
        city: parsed.data.city,
        state: parsed.data.state,
        postalCode: parsed.data.postalCode,
        country: parsed.data.country
      },
      { makeDefault: parsed.data.isDefault }
    );
  } catch {
    return { error: "Could not save address. Please try again." };
  }

  revalidatePath("/portal/addresses");
  revalidatePath("/portal/account");
  return { ok: true };
}

export async function updatePortalAddressAction(
  addressId: string,
  _prev: PortalAddressState,
  formData: FormData
): Promise<PortalAddressState> {
  const customer = await requireCustomerSession();
  const parsed = addressFieldsSchema.safeParse({
    labelPreset: formData.get("labelPreset") || undefined,
    labelCustom: formData.get("labelCustom") || "",
    label: formData.get("label") || undefined,
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

  const phone = parseIndianMobile(parsed.data.phone);
  if (!phone.ok) return { error: phone.error };

  const label = resolveAddressLabel(
    parsed.data.labelPreset || parsed.data.label || "Home",
    parsed.data.labelCustom || ""
  );
  if (typeof label === "object") return label;

  const result = await updatePortalAddressFields(customer.id, addressId, {
    label,
    fullName: parsed.data.fullName,
    phone: phone.digits,
    line1: parsed.data.line1,
    line2: parsed.data.line2,
    city: parsed.data.city,
    state: parsed.data.state,
    postalCode: parsed.data.postalCode,
    country: parsed.data.country,
    isDefault: parsed.data.isDefault
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/portal/addresses");
  revalidatePath("/portal/account");
  return { ok: true };
}

export async function deletePortalAddress(addressId: string) {
  const customer = await requireCustomerSession();
  await deleteOwnedAddress(customer.id, addressId);
  revalidatePath("/portal/addresses");
  revalidatePath("/portal/account");
}

export async function setDefaultPortalAddress(addressId: string) {
  const customer = await requireCustomerSession();
  await setOwnedDefaultAddress(customer.id, addressId);
  revalidatePath("/portal/addresses");
  revalidatePath("/portal/account");
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

  if (orderNumber) {
    const owned = await db.order.findFirst({
      where: { customerId: customer.id, orderNumber },
      select: { id: true }
    });
    if (!owned) {
      return { error: "That order was not found on your account." };
    }
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

export async function logoutPortalAction() {
  await logoutCustomer();
  redirect("/portal/login");
}

export async function toggleWishlistAction(productId: string): Promise<{ ok: true; wishlisted: boolean } | { ok: false; error: string }> {
  const customer = await requireCustomerSession();
  try {
    const result = await toggleWishlistItem(customer.id, productId);
    revalidatePath("/portal/wishlist");
    revalidatePath(`/products`);
    return { ok: true, wishlisted: result.wishlisted };
  } catch {
    return { ok: false, error: "Could not update wishlist." };
  }
}

export async function removeWishlistAction(productId: string) {
  const customer = await requireCustomerSession();
  await removeWishlistItem(customer.id, productId);
  revalidatePath("/portal/wishlist");
}

export async function dismissAddressClaimAction() {
  const customer = await requireCustomerSession();
  await dismissAddressClaimPrompt(customer.id);
  revalidatePath("/portal");
  revalidatePath("/portal/account");
}

export async function confirmAddressClaimAction() {
  const customer = await requireCustomerSession();
  await confirmAddressClaim(customer.id);
  revalidatePath("/portal");
  revalidatePath("/portal/account");
  revalidatePath("/portal/addresses");
}

export async function updateNotificationPrefsAction(
  _prev: PortalProfileState,
  formData: FormData
): Promise<PortalProfileState> {
  const customer = await requireCustomerSession();
  const notifyOrderUpdates = formData.get("notifyOrderUpdates") === "on";
  const notifyMarketing = formData.get("notifyMarketing") === "on";
  await db.customer.update({
    where: { id: customer.id },
    data: { notifyOrderUpdates, notifyMarketing }
  });
  const { syncMarketingSubscriber } = await import("@/lib/customer/marketing-prefs");
  await syncMarketingSubscriber(customer.email, notifyMarketing);
  revalidatePath("/portal/account");
  return { ok: true };
}
