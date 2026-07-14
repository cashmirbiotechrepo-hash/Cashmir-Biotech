"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/customer/auth";
import { db } from "@/lib/db";

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

export async function savePortalAddress(formData: FormData) {
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
  if (!parsed.success) return;

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
}

export async function deletePortalAddress(addressId: string, _formData?: FormData) {
  const customer = await requireCustomerSession();
  await db.customerAddress.deleteMany({ where: { id: addressId, customerId: customer.id } });
  revalidatePath("/portal/addresses");
}

export async function setDefaultPortalAddress(addressId: string, _formData?: FormData) {
  const customer = await requireCustomerSession();
  const owned = await db.customerAddress.findFirst({ where: { id: addressId, customerId: customer.id } });
  if (!owned) return;
  await db.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
  await db.customerAddress.update({ where: { id: addressId }, data: { isDefault: true } });
  revalidatePath("/portal/addresses");
}
