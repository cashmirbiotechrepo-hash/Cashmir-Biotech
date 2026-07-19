"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAdmin, requireAdminSession } from "@/lib/auth";
import { DESTRUCTIVE_ROLES, OPERATIONS_ROLES, hasAdminRole } from "@/lib/admin/rbac";
import {
  initializeInventory,
  reconcileFromProductForm,
  deductStockForOrder,
  restoreStockForOrder,
  releaseReservationForOrder,
  shouldDeduct,
  shouldRestore
} from "@/modules/admin/services/inventory.service";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import {
  homepageSettingsSchema,
  patentUpdateSchema,
  teamMemberUpdateSchema,
  customFieldSchema,
  measurementsSchema,
  specsSchema,
  usageSchema,
  otherInfoSchema
} from "@/modules/cms/validations/admin";
import {
  updatePatentContent,
  upsertHomepageContent,
  upsertShippingSettings
} from "@/modules/cms/services/content.service";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { paiseFromInr } from "@/lib/pricing";
import { stripEmptyStrings } from "@/lib/product-sections";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export type ActionState = { ok?: boolean; message?: string; error?: string };

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
      .slice(0, 80) || "item"
  );
}

async function uniqueProductSlug(name: string) {
  const base = slugify(name);
  const existing = await db.product.findUnique({ where: { slug: base } });
  return existing ? `${base}-${randomBytes(3).toString("hex")}` : base;
}

/** Compresses a string into an uppercase alphanumeric code of a fixed length (padded with X). */
function skuSegment(value: string, length: number) {
  const cleaned = (value || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, length).padEnd(length, "X");
}

/** Builds a readable, collision-checked SKU like CB-FUN-MAG-A1B2. */
async function generateUniqueSku(name: string, category: string) {
  const cat = skuSegment(category || "GEN", 3);
  const nm = skuSegment(name || "PRD", 3);
  for (let attempt = 0; attempt < 8; attempt++) {
    const rand = randomBytes(2).toString("hex").toUpperCase();
    const sku = `CB-${cat}-${nm}-${rand}`;
    const clash = await db.product.findFirst({ where: { sku }, select: { id: true } });
    if (!clash) return sku;
  }
  return `CB-${cat}-${nm}-${Date.now().toString(36).toUpperCase()}`;
}

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const productUpsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(500),
    shortBenefit: z.string().trim().min(1).max(500),
    description: z.string().max(50000),
    mrpInr: z.coerce.number().int().positive("MRP must be greater than zero").max(100_000_000),
    sellingPriceInr: z.coerce
      .number()
      .int()
      .positive("Selling price must be greater than zero")
      .max(100_000_000),
    currency: z.string().trim().min(1).max(8).default("INR"),
    minOrderQty: z.coerce.number().int().min(1).max(100).default(1),
    maxOrderQty: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const n = typeof val === "number" ? val : Number(val);
      return Number.isFinite(n) ? n : undefined;
    }, z.number().int().min(1).max(100).optional()),
    sizeLabel: z.string().trim().min(1).max(200),
    imageUrl: z.string().trim().min(1).max(2000),
    category: z.string().trim().max(200).optional(),
    sku: z.string().optional(),
    stockQty: z.coerce.number().int().min(0),
    lowStockThreshold: z.coerce.number().int().min(0),
    leadTimeDays: z.coerce.number().int().min(0).max(365).optional(),
    images: z.string().optional(),
    featured: checkbox,
    hasInventoryTracking: checkbox,
    active: checkbox,
    taxIncluded: checkbox,
    measurementsJson: z.string().optional(),
    specsJson: z.string().optional(),
    usageJson: z.string().optional(),
    otherInfoJson: z.string().optional(),
    customFieldsJson: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (data.sellingPriceInr > data.mrpInr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selling price cannot exceed MRP",
        path: ["sellingPriceInr"]
      });
    }
    if (data.maxOrderQty != null && data.maxOrderQty < data.minOrderQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max order quantity must be ≥ min order quantity",
        path: ["maxOrderQty"]
      });
    }
  });

function parseGallery(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim())
        .slice(0, 12);
    }
  } catch {
    // fall through to empty
  }
  return [];
}

function parseJsonBlock<T>(
  raw: string | undefined,
  schema: z.ZodType<T>
): T | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (!result.success) return undefined;
    const stripped = stripEmptyStrings(result.data as Record<string, unknown>);
    return Object.keys(stripped).length > 0 ? (stripped as T) : undefined;
  } catch {
    return undefined;
  }
}

function parseCustomFields(raw: string | undefined) {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const fields: Array<{ label: string; value: string; sortOrder: number }> = [];
    for (let i = 0; i < Math.min(parsed.length, 40); i++) {
      const result = customFieldSchema.safeParse({
        ...(typeof parsed[i] === "object" && parsed[i] ? parsed[i] : {}),
        sortOrder: i
      });
      if (result.success) fields.push(result.data);
    }
    return fields;
  } catch {
    return [];
  }
}

export async function saveHomepageAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = homepageSettingsSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the homepage fields." };
  }
  try {
    await upsertHomepageContent(parsed.data);
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update",
      entityType: "homepage",
      entityId: "1"
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true, message: "Homepage published." };
  } catch (error) {
    logger.error({ err: error, event: "homepage_save_failed" }, "failed to save homepage");
    return { error: "Couldn't save homepage. Check your connection and try again." };
  }
}

export async function saveProductAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = productUpsertSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the product fields." };
  }
  const {
    id,
    sku,
    stockQty,
    lowStockThreshold,
    active,
    featured,
    leadTimeDays,
    hasInventoryTracking,
    images,
    category,
    sellingPriceInr,
    mrpInr,
    currency,
    taxIncluded,
    minOrderQty,
    maxOrderQty,
    measurementsJson,
    specsJson,
    usageJson,
    otherInfoJson,
    customFieldsJson,
    ...data
  } = parsed.data;

  const gallery = parseGallery(images);
  const trimmedSku = sku?.trim() ?? "";
  const pricePaise = paiseFromInr(sellingPriceInr);
  const measurements = parseJsonBlock(measurementsJson, measurementsSchema);
  const specs = parseJsonBlock(specsJson, specsSchema);
  const usage = parseJsonBlock(usageJson, usageSchema);
  const otherInfo = parseJsonBlock(otherInfoJson, otherInfoSchema);
  const customFields = parseCustomFields(customFieldsJson);

  const productData = {
    ...data,
    mrpInr,
    pricePaise,
    currency: currency || "INR",
    taxIncluded,
    minOrderQty,
    maxOrderQty: maxOrderQty ?? null,
    measurements: measurements ?? Prisma.DbNull,
    specs: specs ?? Prisma.DbNull,
    usage: usage ?? Prisma.DbNull,
    otherInfo: otherInfo ?? Prisma.DbNull
  };

  try {
    if (id) {
      let finalSku = trimmedSku;
      if (!finalSku) {
        const current = await db.product.findUnique({ where: { id }, select: { sku: true } });
        finalSku = current?.sku?.trim() || (await generateUniqueSku(data.name, category || "Functional Food"));
      }
      await db.$transaction(async (tx) => {
        await tx.productCustomField.deleteMany({ where: { productId: id } });
        await tx.product.update({
          where: { id },
          data: {
            ...productData,
            ...(category ? { category } : {}),
            ...(leadTimeDays !== undefined ? { leadTimeDays } : {}),
            sku: finalSku,
            images: gallery,
            stockQty,
            lowStockThreshold,
            featured,
            hasInventoryTracking,
            active,
            customFields: {
              create: customFields.map((f, i) => ({
                label: f.label,
                value: f.value,
                sortOrder: i
              }))
            }
          }
        });
      });
      if (hasInventoryTracking) {
        await reconcileFromProductForm({
          productId: id,
          sku: finalSku,
          newOnHand: stockQty,
          threshold: lowStockThreshold,
          createdBy: String(admin.email)
        });
      }
    } else {
      const finalSku = trimmedSku || (await generateUniqueSku(data.name, category || "Functional Food"));
      await db.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            ...productData,
            slug: await uniqueProductSlug(data.name),
            category: category || "Functional Food",
            ...(leadTimeDays !== undefined ? { leadTimeDays } : {}),
            sku: finalSku,
            images: gallery,
            stockQty,
            lowStockThreshold,
            featured,
            hasInventoryTracking,
            active,
            customFields: {
              create: customFields.map((f, i) => ({
                label: f.label,
                value: f.value,
                sortOrder: i
              }))
            }
          }
        });
        if (hasInventoryTracking) {
          await initializeInventory(tx, {
            productId: product.id,
            sku: product.sku,
            quantity: stockQty,
            threshold: lowStockThreshold,
            createdBy: String(admin.email)
          });
        }
      });
    }
    await writeAuditLog({
      userEmail: String(admin.email),
      action: id ? "update" : "create",
      entityType: "product",
      entityId: id ?? data.name,
      diff: { name: data.name, stockQty, active, mrpInr, sellingPriceInr }
    });
    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath("/admin/products");
    return { ok: true, message: id ? `Saved “${data.name}”.` : `Created “${data.name}”.` };
  } catch (error) {
    logger.error({ err: error, event: "product_save_failed" }, "failed to save product");
    return { error: "Couldn't save this product." };
  }
}

export async function deleteProductAction(formData: FormData): Promise<ActionState> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Session expired." };
  if (!hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) {
    return { error: "You don't have permission to delete products." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product id." };
  try {
    await db.product.delete({ where: { id } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "product",
      entityId: id
    });
    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath("/admin/products");
    return { ok: true, message: "Product deleted." };
  } catch (error) {
    logger.error({ err: error, event: "product_delete_failed" }, "failed to delete product");
    return { error: "Couldn't delete this product. It may be linked to existing orders." };
  }
}

/** Quick stock adjust from the products list — does not require the full editor form. */
export async function updateProductStockAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const id = String(formData.get("id") ?? "").trim();
  const stockQty = Number(formData.get("stockQty"));
  if (!id) return { error: "Missing product id." };
  if (!Number.isInteger(stockQty) || stockQty < 0) return { error: "Stock must be a whole number ≥ 0." };

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: { id: true, name: true, sku: true, lowStockThreshold: true, hasInventoryTracking: true }
    });
    if (!product) return { error: "Product not found." };

    await db.product.update({ where: { id }, data: { stockQty } });
    if (product.hasInventoryTracking) {
      await reconcileFromProductForm({
        productId: id,
        sku: product.sku,
        newOnHand: stockQty,
        threshold: product.lowStockThreshold,
        createdBy: String(admin.email)
      });
    }
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update",
      entityType: "product",
      entityId: id,
      diff: { stockQty }
    });
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");
    revalidatePath("/products");
    return { ok: true, message: `Stock for “${product.name}” set to ${stockQty}.` };
  } catch (error) {
    logger.error({ err: error, event: "product_stock_update_failed" }, "failed to update product stock");
    return { error: "Couldn't update stock." };
  }
}

export async function savePatentAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = patentUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the patent fields." };
  }
  const { id, ...data } = parsed.data;
  try {
    await updatePatentContent(id, data);
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update",
      entityType: "patent",
      entityId: id,
      diff: data
    });
    revalidatePath("/patents");
    revalidatePath("/");
    revalidatePath("/admin/content/patents");
    return { ok: true, message: `Saved “${data.title}”.` };
  } catch (error) {
    logger.error({ err: error, event: "patent_save_failed" }, "failed to save patent");
    return { error: "Couldn't save this patent." };
  }
}

const teamMemberUpsertSchema = teamMemberUpdateSchema.extend({
  id: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).optional()
});

export async function saveTeamMemberAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = teamMemberUpsertSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the board member fields." };
  }
  const { id, sortOrder, ...data } = parsed.data;
  try {
    if (id) {
      await db.teamMember.update({
        where: { id },
        data: { ...data, ...(sortOrder !== undefined ? { sortOrder } : {}) }
      });
    } else {
      const count = await db.teamMember.count();
      await db.teamMember.create({
        data: { ...data, sortOrder: sortOrder ?? count }
      });
    }
    await writeAuditLog({
      userEmail: String(admin.email),
      action: id ? "update" : "create",
      entityType: "team_member",
      entityId: id ?? data.fullName,
      diff: { fullName: data.fullName, role: data.role }
    });
    revalidatePath("/team");
    revalidatePath("/admin/content/team");
    return { ok: true, message: id ? `Saved ${data.fullName}.` : `Added ${data.fullName}.` };
  } catch (error) {
    logger.error({ err: error, event: "team_save_failed" }, "failed to save team member");
    return { error: "Couldn't save this board member." };
  }
}

export async function deleteTeamMemberAction(formData: FormData): Promise<ActionState> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Session expired." };
  if (!hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) {
    return { error: "You don't have permission to delete board members." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing member id." };
  try {
    await db.teamMember.delete({ where: { id } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "team_member",
      entityId: id
    });
    revalidatePath("/team");
    revalidatePath("/admin/content/team");
    return { ok: true, message: "Board member removed." };
  } catch (error) {
    logger.error({ err: error, event: "team_delete_failed" }, "failed to delete team member");
    return { error: "Couldn't remove this board member." };
  }
}

const orderStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "payment_failed",
    "refunded",
    "partially_refunded"
  ])
});

export async function moveTeamMemberAction(formData: FormData): Promise<void> {
  const admin = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;
  try {
    const members = await db.teamMember.findMany({ orderBy: { sortOrder: "asc" } });
    const index = members.findIndex((m) => m.id === id);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= members.length) return;

    const current = members[index];
    const neighbor = members[swapWith];
    await db.$transaction([
      db.teamMember.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
      db.teamMember.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } })
    ]);
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "reorder",
      entityType: "team_member",
      entityId: current.id,
      diff: { direction }
    });
    revalidatePath("/team");
    revalidatePath("/admin/content/team");
  } catch {
    // no-op; page revalidates on next navigation
  }
}

export async function updateOrderStatusAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "You do not have permission to update orders." };
  }
  const parsed = orderStatusSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: "Invalid order status." };
  }
  try {
    const order = await db.order.findUnique({
      where: { id: parsed.data.id },
      include: { items: true }
    });
    if (!order) return { error: "Order not found." };

    const newStatus = parsed.data.status;
    const { canTransition } = await import("@/lib/admin/order-workflow");
    if (!canTransition(order.status, newStatus)) {
      return {
        error: `Cannot move from ${order.status} to ${newStatus}. Use the allowed next step only.`
      };
    }

    const lines = order.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      productName: i.productName
    }));

    // Start packing → ensure GST invoice exists before warehouse work continues
    if (newStatus === "processing" && order.status !== "processing") {
      const { ensureInvoiceForOrder } = await import("@/modules/shop/services/order-ops.service");
      await ensureInvoiceForOrder(order.id).catch(() => undefined);
    }

    let stockDeducted = order.stockDeducted;
    let stockReserved = order.stockReserved;
    if (shouldDeduct(newStatus) && !order.stockDeducted) {
      await deductStockForOrder({
        orderId: order.id,
        lines,
        releaseReserved: order.stockReserved,
        createdBy: String(admin.email)
      });
      stockDeducted = true;
      stockReserved = false;
    } else if (shouldRestore(newStatus) && order.stockDeducted) {
      await restoreStockForOrder({
        orderId: order.id,
        lines,
        changeType: newStatus === "refunded" ? "order_returned" : "order_cancelled",
        createdBy: String(admin.email)
      });
      stockDeducted = false;
    } else if (shouldRestore(newStatus) && !order.stockDeducted && order.stockReserved) {
      // Reserved at checkout but never paid — release the hold rather than touching on-hand.
      await releaseReservationForOrder({ orderId: order.id, lines });
      stockReserved = false;
    }

    await db.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        stockDeducted,
        stockReserved,
        ...(newStatus === "shipped" ? { shippedAt: new Date() } : {})
      }
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update_status",
      entityType: "order",
      entityId: order.id,
      diff: { status: newStatus, stockDeducted }
    });

    const { recordOrderEvent, notifyCustomerShipped } = await import(
      "@/modules/shop/services/order-ops.service"
    );
    await recordOrderEvent({
      orderId: order.id,
      type: "status_changed",
      title:
        newStatus === "processing"
          ? "Packing started"
          : newStatus === "shipped"
            ? "Order dispatched"
            : newStatus === "delivered"
              ? "Order delivered"
              : newStatus === "cancelled"
                ? "Order cancelled"
                : newStatus === "paid"
                  ? "Marked paid"
                  : `Status → ${newStatus}`,
      detail: order.status !== newStatus ? `Was ${order.status}` : "",
      actorEmail: String(admin.email),
      metadata: { from: order.status, to: newStatus }
    });

    if (newStatus === "shipped" && order.status !== "shipped") {
      await notifyCustomerShipped(order.id).catch(() => undefined);
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/inventory");
    return { ok: true, message: "Order status updated." };
  } catch (error) {
    logger.error({ err: error, event: "order_status_failed" }, "failed to update order");
    return { error: "Couldn't update order status." };
  }
}

const orderFulfillmentSchema = z.object({
  id: z.string().min(1),
  trackingNumber: z.string().trim().max(200).optional(),
  carrier: z.string().trim().max(120).optional(),
  adminNotes: z.string().trim().max(5000).optional()
});

export async function updateOrderFulfillmentAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "You do not have permission to update fulfillment." };
  }
  const parsed = orderFulfillmentSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: "Invalid fulfillment details." };
  }
  try {
    const before = await db.order.findUnique({ where: { id: parsed.data.id } });
    await db.order.update({
      where: { id: parsed.data.id },
      data: {
        trackingNumber: parsed.data.trackingNumber ?? "",
        carrier: parsed.data.carrier ?? "",
        adminNotes: parsed.data.adminNotes ?? ""
      }
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update_fulfillment",
      entityType: "order",
      entityId: parsed.data.id,
      diff: { trackingNumber: parsed.data.trackingNumber, carrier: parsed.data.carrier }
    });

    const { recordOrderEvent, notifyCustomerShipped } = await import(
      "@/modules/shop/services/order-ops.service"
    );
    const trackingChanged =
      before &&
      ((parsed.data.trackingNumber ?? "") !== before.trackingNumber ||
        (parsed.data.carrier ?? "") !== before.carrier);

    await recordOrderEvent({
      orderId: parsed.data.id,
      type: "fulfillment_updated",
      title: trackingChanged ? "Courier / tracking updated" : "Fulfillment notes updated",
      detail: [parsed.data.carrier, parsed.data.trackingNumber].filter(Boolean).join(" · "),
      actorEmail: String(admin.email)
    });

    if (
      trackingChanged &&
      (parsed.data.trackingNumber ?? "").trim() &&
      before &&
      (before.status === "shipped" || before.status === "processing" || before.status === "paid")
    ) {
      await notifyCustomerShipped(parsed.data.id).catch(() => undefined);
    }

    revalidatePath(`/admin/orders/${parsed.data.id}`);
    revalidatePath("/admin/orders");
    return { ok: true, message: "Fulfillment details saved." };
  } catch (error) {
    logger.error({ err: error, event: "order_fulfillment_failed" }, "failed to update fulfillment");
    return { error: "Couldn't save fulfillment details." };
  }
}

const shippingSettingsSchema = z.object({
  flatShippingInr: z.coerce.number().int().min(0).max(100_000),
  freeShippingThresholdInr: z.coerce.number().int().min(0).max(10_000_000)
});

export async function saveShippingSettingsAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "You do not have permission to update shipping settings." };
  }
  const parsed = shippingSettingsSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the shipping amounts." };
  }
  try {
    await upsertShippingSettings(parsed.data);
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update",
      entityType: "shipping_settings",
      entityId: "1",
      diff: parsed.data
    });
    revalidatePath("/admin/shipping");
    revalidatePath("/cart");
    revalidatePath("/checkout");
    revalidatePath("/products");
    return { ok: true, message: "Store shipping defaults saved." };
  } catch (error) {
    logger.error({ err: error, event: "shipping_settings_failed" }, "failed to save shipping");
    return { error: "Couldn't save shipping settings." };
  }
}

const orderShippingSchema = z.object({
  id: z.string().min(1),
  shippingInr: z.coerce.number().int().min(0).max(100_000)
});

export async function updateOrderShippingAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "You do not have permission to override order shipping." };
  }
  const parsed = orderShippingSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: "Enter a valid shipping amount in rupees." };
  }
  try {
    const order = await db.order.findUnique({ where: { id: parsed.data.id } });
    if (!order) return { error: "Order not found." };
    if (order.status === "cancelled" || order.status === "refunded") {
      return { error: "Cannot change shipping on a cancelled or refunded order." };
    }

    const shippingCents = parsed.data.shippingInr * 100;
    const discountCents = order.discountCents ?? 0;
    const totalCents = order.subtotalCents - discountCents + order.taxCents + shippingCents;
    if (totalCents < 0) return { error: "Shipping would make the order total negative." };
    if ((order.refundedCents ?? 0) > totalCents) {
      return { error: "New total would be below amount already refunded." };
    }

    const unpaid = order.status === "pending" || order.status === "payment_failed";
    const clearRazorpay = unpaid && Boolean(order.razorpayOrderId);

    await db.order.update({
      where: { id: order.id },
      data: {
        shippingCents,
        totalCents,
        ...(clearRazorpay ? { razorpayOrderId: null } : {})
      }
    });

    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update_shipping",
      entityType: "order",
      entityId: order.id,
      diff: {
        fromShippingCents: order.shippingCents,
        toShippingCents: shippingCents,
        fromTotalCents: order.totalCents,
        toTotalCents: totalCents,
        clearedRazorpayOrder: clearRazorpay
      }
    });

    const { recordOrderEvent } = await import("@/modules/shop/services/order-ops.service");
    await recordOrderEvent({
      orderId: order.id,
      type: "shipping_overridden",
      title: "Shipping amount overridden",
      detail: `₹${order.shippingCents / 100} → ₹${parsed.data.shippingInr}${
        clearRazorpay ? " · Pending payment intent cleared" : ""
      }`,
      actorEmail: String(admin.email),
      metadata: {
        fromShippingCents: order.shippingCents,
        toShippingCents: shippingCents,
        fromTotalCents: order.totalCents,
        toTotalCents: totalCents
      }
    });

    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath("/admin/orders");
    return {
      ok: true,
      message: clearRazorpay
        ? "Shipping updated. Customer must check out again so payment matches the new total."
        : unpaid
          ? "Shipping updated for this order."
          : "Shipping updated on this order. Razorpay charge is unchanged — issue a refund or note if money already collected."
    };
  } catch (error) {
    logger.error({ err: error, event: "order_shipping_override_failed" }, "failed to override shipping");
    return { error: "Couldn't update order shipping." };
  }
}

const subscriberStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["subscribed", "unsubscribed"])
});

export async function updateSubscriberStatusAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const parsed = subscriberStatusSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: "Invalid request." };
  try {
    await db.subscriber.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        unsubscribedAt: parsed.data.status === "unsubscribed" ? new Date() : null
      }
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: parsed.data.status === "unsubscribed" ? "unsubscribe" : "resubscribe",
      entityType: "subscriber",
      entityId: parsed.data.id
    });
    revalidatePath("/admin/subscribers");
    return { ok: true, message: "Subscriber updated." };
  } catch {
    return { error: "Couldn't update subscriber." };
  }
}

export async function deleteSubscriberAction(formData: FormData): Promise<ActionState> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Session expired." };
  if (!hasAdminRole(admin.role, DESTRUCTIVE_ROLES)) {
    return { error: "You don't have permission to delete subscribers." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing subscriber id." };
  try {
    await db.subscriber.delete({ where: { id } });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "delete",
      entityType: "subscriber",
      entityId: id
    });
    revalidatePath("/admin/subscribers");
    return { ok: true, message: "Subscriber removed." };
  } catch {
    return { error: "Couldn't remove subscriber." };
  }
}

export async function addSubscriberAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  try {
    await db.subscriber.upsert({
      where: { email },
      update: { status: "subscribed", unsubscribedAt: null },
      create: { email, source: "admin" }
    });
    await writeAuditLog({
      userEmail: String(admin.email),
      action: "create",
      entityType: "subscriber",
      entityId: email
    });
    revalidatePath("/admin/subscribers");
    return { ok: true, message: "Subscriber added." };
  } catch {
    return { error: "Couldn't add subscriber." };
  }
}

export async function signOutAction() {
  const { getCurrentAdmin, clearAdminSessionCookies } = await import("@/lib/auth");
  const { AdminAuthService } = await import("@/lib/admin/auth-service");
  const admin = await getCurrentAdmin();
  if (admin?.sessionId) {
    await AdminAuthService.logout(admin.sessionId, admin.email);
  }
  await clearAdminSessionCookies();
  redirect("/admin/login");
}
