import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPendingOrder, priceCart } from "@/modules/shop/services/order.service";
import { createOrRestockLot } from "@/modules/admin/services/inventory-lots.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev/E2E-only fixture: pending order + signed webhook payload for money-path tests.
 * Disabled unless E2E_HOOKS_ENABLED=true (never in production).
 */
export async function POST(request: Request) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.E2E_HOOKS_ENABLED !== "true"
  ) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const secret = process.env.E2E_HOOKS_SECRET;
  if (!secret || request.headers.get("x-e2e-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let product = await db.product.findFirst({
    where: { active: true, hasInventoryTracking: true },
    orderBy: { createdAt: "asc" }
  });

  if (!product) {
    product = await db.product.create({
      data: {
        slug: `e2e-product-${Date.now()}`,
        name: "E2E Test Formulation",
        shortBenefit: "Fixture",
        description: "Playwright money-path fixture product",
        mrpInr: 999,
        pricePaise: 99900,
        sizeLabel: "30ml",
        category: "test",
        imageUrl: "/placeholder.png",
        sku: `E2E-${Date.now()}`,
        stockQty: 50,
        hasInventoryTracking: true,
        active: true
      }
    });
  }

  let inventory = await db.inventory.findUnique({ where: { productId: product.id } });
  if (!inventory) {
    inventory = await db.inventory.create({
      data: {
        productId: product.id,
        sku: product.sku,
        quantityOnHand: 50,
        quantityReserved: 0
      }
    });
  } else if (inventory.quantityOnHand - inventory.quantityReserved < 5) {
    await db.inventory.update({
      where: { id: inventory.id },
      data: { quantityOnHand: { increment: 50 } }
    });
  }

  await createOrRestockLot({
    productId: product.id,
    lotCode: `E2E-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
    quantity: 5,
    bumpAggregate: true,
    notes: "E2E fixture lot"
  }).catch(() => undefined);

  const priced = await priceCart([{ productId: product.id, quantity: 1 }]);
  if (!priced.ok) {
    return NextResponse.json({ ok: false, error: priced.error }, { status: 500 });
  }

  const created = await createPendingOrder({
    cart: priced.cart,
    address: {
      fullName: "E2E Tester",
      phone: "9999999999",
      email: "e2e@cashmirbiotech.test",
      line1: "1 Test Lane",
      line2: "",
      city: "Srinagar",
      state: "JK",
      postalCode: "190001",
      country: "India"
    }
  });

  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 500 });
  }

  const razorpayOrderId = `order_e2e_${created.orderNumber}`;
  await db.order.update({
    where: { id: created.orderId },
    data: { razorpayOrderId }
  });

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "e2e_webhook_secret";
  const paymentId = `pay_e2e_${Date.now()}`;
  const payload = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: razorpayOrderId,
          status: "captured"
        }
      }
    }
  };
  const raw = JSON.stringify(payload);
  const signature = createHmac("sha256", webhookSecret).update(raw).digest("hex");

  return NextResponse.json({
    ok: true,
    orderId: created.orderId,
    orderNumber: created.orderNumber,
    confirmationToken: created.confirmationToken,
    razorpayOrderId,
    paymentId,
    webhook: {
      body: raw,
      signature,
      eventId: `evt_e2e_${paymentId}`
    }
  });
}
