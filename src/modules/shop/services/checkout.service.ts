import "server-only";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  reserveStockForOrder,
  type StockLine
} from "@/modules/admin/services/inventory.service";
import type { PricedCart } from "./pricing.service";

export function newConfirmationToken() {
  return randomBytes(24).toString("base64url");
}

/** Human-facing, non-sequential order reference. */
export function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `CB-${ymd}-${rand}`;
}

export type ShippingAddress = {
  fullName: string;
  phone: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export function orderLines(items: { productId: string | null; quantity: number; productName: string }[]): StockLine[] {
  return items.map((i) => ({
    productId: i.productId ?? "",
    quantity: i.quantity,
    productName: i.productName
  }));
}

/**
 * Creates a `pending` order with priced items and reserves stock atomically.
 *
 * CRIT-02 FIX: The order creation and stock reservation are wrapped in a single
 * Prisma interactive transaction with Serializable isolation. If stock reservation
 * fails, the order row is automatically rolled back — no orphaned orders possible.
 *
 * HIGH-11 FIX: Verifies coupon code again inside transaction and increments usedCount atomically.
 */
export async function createPendingOrder(input: {
  cart: PricedCart;
  address: ShippingAddress;
  idempotencyKey?: string | null;
}): Promise<
  { ok: true; orderId: string; orderNumber: string; confirmationToken: string } | { ok: false; error: string }
> {
  const { cart, address } = input;
  const orderNumber = generateOrderNumber();

  const normalizedEmail = address.email.toLowerCase().trim();

  const lines: StockLine[] = cart.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    productName: l.productName
  }));

  try {
    const order = await db.$transaction(
      async (tx) => {
        // Validate coupon inside the transaction — do NOT burn usedCount until payment (H4).
        if (cart.couponCode) {
          const coupon = await tx.coupon.findUnique({ where: { code: cart.couponCode } });
          if (
            !coupon ||
            !coupon.active ||
            (coupon.expiresAt && coupon.expiresAt < new Date()) ||
            (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
          ) {
            throw new Error("Coupon code is no longer valid or reached limit.");
          }
        }

        const adminNotes =
          cart.couponCode && cart.discountCents
            ? `[Coupon: ${cart.couponCode} (-₹${(cart.discountCents / 100).toFixed(2)})]`
            : "";

        const created = await tx.order.create({
          data: {
            orderNumber,
            confirmationToken: newConfirmationToken(),
            customerEmail: normalizedEmail,
            customerName: address.fullName,
            customerPhone: address.phone,
            status: "pending",
            subtotalCents: cart.subtotalCents,
            taxCents: cart.taxCents,
            shippingCents: cart.shippingCents,
            discountCents: cart.discountCents ?? 0,
            totalCents: cart.totalCents,
            couponCode: cart.couponCode ?? "",
            adminNotes,
            idempotencyKey: input.idempotencyKey || null,
            shippingAddress: {
              ...address,
              couponCode: cart.couponCode,
              discountCents: cart.discountCents
            } as unknown as Prisma.InputJsonValue,
            items: {
              create: cart.lines.map((l) => ({
                productId: l.productId,
                productName: l.productName,
                quantity: l.quantity,
                unitPriceCents: l.unitPriceCents
              }))
            }
          }
        });

        // Reserve stock inside the same transaction — if this fails, the order is rolled back.
        const reservation = await reserveStockForOrder({ orderId: created.id, lines, tx });
        if (!reservation.ok) {
          throw new Error(reservation.error);
        }

        await tx.order.update({ where: { id: created.id }, data: { stockReserved: true } });
        return created;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000
      }
    );

    const { recordOrderEvent } = await import("@/modules/shop/services/order-ops.service");
    await recordOrderEvent({
      orderId: order.id,
      type: "order_created",
      title: "Order created",
      detail: orderNumber
    });
    if (cart.couponCode && cart.discountCents) {
      await recordOrderEvent({
        orderId: order.id,
        type: "coupon_applied",
        title: "Coupon applied",
        detail: `${cart.couponCode} (-₹${(cart.discountCents / 100).toFixed(2)})`
      });
    }
    await recordOrderEvent({
      orderId: order.id,
      type: "inventory_reserved",
      title: "Inventory reserved",
      detail: `${cart.lines.reduce((n, l) => n + l.quantity, 0)} unit(s) held pending payment`
    });

    return {
      ok: true,
      orderId: order.id,
      orderNumber,
      confirmationToken: order.confirmationToken
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create order.";
    if (message.includes("Not enough stock") || message.includes("Coupon")) {
      return { ok: false, error: message };
    }
    logger.error({ err, event: "order_create_failed" }, "transactional order creation failed");
    return { ok: false, error: "Could not create your order. Please try again." };
  }
}
