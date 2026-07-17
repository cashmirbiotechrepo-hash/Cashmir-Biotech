"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { hasAdminRole, OPERATIONS_ROLES } from "@/lib/admin/rbac";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import { ensureInvoiceForOrder } from "@/modules/shop/services/order-ops.service";
import { createRazorpayRefund } from "@/lib/payments/razorpay";
import { applyOrderRefund } from "@/modules/shop/services/refund.service";
import type { ActionState } from "./actions";

export async function ensureInvoiceForOrderAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "You do not have permission to manage invoices." };
  }
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order." };

  try {
    const result = await ensureInvoiceForOrder(orderId);
    if (!result.invoiceId) return { error: "Could not create invoice." };

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, confirmationToken: true }
    });
    if (order) {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const pdfUrl = `${site}/api/order/${order.orderNumber}/invoice.pdf?t=${order.confirmationToken}`;
      await db.invoice.update({ where: { id: result.invoiceId }, data: { pdfUrl } });
    }

    await writeAuditLog({
      userEmail: String(admin.email),
      action: result.created ? "create" : "view",
      entityType: "invoice",
      entityId: result.invoiceId,
      diff: { invoiceNumber: result.invoiceNumber, orderId, auto: true }
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/finance");
    return {
      ok: true,
      message: result.created
        ? `Invoice ${result.invoiceNumber} created.`
        : `Invoice ${result.invoiceNumber} already exists.`
    };
  } catch {
    return { error: "Couldn't generate invoice." };
  }
}

/** Issues a Razorpay refund (full or partial) and updates refundedCents / status. */
export async function refundOrderAction(formData: FormData): Promise<ActionState> {
  const admin = await requireAdminSession();
  if (!hasAdminRole(admin.role, OPERATIONS_ROLES)) {
    return { error: "You do not have permission to issue refunds." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "Customer request").slice(0, 200);
  const restock = formData.get("restock") === "on" || formData.get("restock") === "true";
  const amountInrRaw = String(formData.get("amountInr") ?? "").trim();
  if (!orderId) return { error: "Missing order." };

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { error: "Order not found." };
  if (order.status === "refunded") return { error: "Order is already fully refunded." };
  if (!["paid", "processing", "shipped", "delivered", "partially_refunded"].includes(order.status)) {
    return { error: "Only paid orders can be refunded." };
  }
  if (!order.razorpayPaymentId || order.razorpayPaymentId.startsWith("test_skip_")) {
    return { error: "No Razorpay payment on this order. Mark refunded manually if needed." };
  }

  const remainingCents = Math.max(0, order.totalCents - (order.refundedCents ?? 0));
  if (remainingCents <= 0) return { error: "Nothing left to refund." };

  let amountCents = remainingCents;
  if (amountInrRaw) {
    const inr = Number(amountInrRaw);
    if (!Number.isFinite(inr) || inr <= 0) return { error: "Enter a valid refund amount in INR." };
    amountCents = Math.round(inr * 100);
    if (amountCents > remainingCents) {
      return { error: `Amount exceeds remaining refundable ₹${(remainingCents / 100).toFixed(2)}.` };
    }
  }

  try {
    const refund = await createRazorpayRefund({
      paymentId: order.razorpayPaymentId,
      amountCents,
      notes: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason,
        by: String(admin.email),
        partial: amountCents < remainingCents || (order.refundedCents ?? 0) > 0 ? "1" : "0"
      }
    });

    const fullyRefundedPreview = (order.refundedCents ?? 0) + amountCents >= order.totalCents;

    const applied = await applyOrderRefund({
      orderId: order.id,
      razorpayRefundId: refund.id,
      amountCents,
      source: "admin",
      restock: restock && fullyRefundedPreview,
      actorEmail: String(admin.email),
      reason,
      eventType: "refund_issued"
    });

    if (!applied.ok) {
      return { error: "Refund was created at Razorpay but could not be recorded. Contact support." };
    }

    await db.order.update({
      where: { id: order.id },
      data: {
        adminNotes: `${order.adminNotes}\n[Refund ${refund.id} ₹${(amountCents / 100).toFixed(2)}] ${reason}`.trim()
      }
    });

    await writeAuditLog({
      userEmail: String(admin.email),
      action: "update",
      entityType: "order",
      entityId: order.id,
      diff: {
        refundId: refund.id,
        amountCents,
        refundedCents: applied.newRefundedCents,
        reason,
        restock,
        fullyRefunded: applied.fullyRefunded,
        duplicate: applied.duplicate
      }
    });

    if (order.customerEmail && applied.applied) {
      const { buildRefundMail } = await import("@/lib/email/transactional");
      const { sendTransactionalMail } = await import("@/lib/admin/mail");
      const mail = buildRefundMail({
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        amountCents,
        reason,
        confirmationToken: order.confirmationToken
      });
      await sendTransactionalMail({ to: order.customerEmail, mail }).catch(() => undefined);
    }

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return {
      ok: true,
      message: applied.fullyRefunded
        ? `Full refund ${refund.id} issued.`
        : `Partial refund ${refund.id} of ₹${(amountCents / 100).toFixed(2)} issued.`
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Refund failed." };
  }
}
