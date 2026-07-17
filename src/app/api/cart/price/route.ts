import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { priceCart } from "@/modules/shop/services/order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(20)
      })
    )
    .min(1)
    .max(50),
  couponCode: z.string().trim().max(50).optional()
});

/**
 * Re-price cart lines from the database for display before checkout.
 * Client prices in localStorage are advisory only.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid cart." }, { status: 422 });
  }

  const priced = await priceCart(parsed.data.items, parsed.data.couponCode);
  if (!priced.ok) {
    return NextResponse.json({ ok: false, error: priced.error }, { status: 409 });
  }

  const products = await db.product.findMany({
    where: { id: { in: priced.cart.lines.map((l) => l.productId) } },
    select: {
      id: true,
      slug: true,
      name: true,
      sizeLabel: true,
      imageUrl: true,
      mrpInr: true,
      stockQty: true
    }
  });

  const items = priced.cart.lines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    return {
      productId: line.productId,
      slug: product?.slug ?? "",
      name: product?.name ?? line.productName,
      sizeLabel: product?.sizeLabel ?? "",
      imageUrl: product?.imageUrl ?? "",
      priceInr: line.unitPriceCents / 100,
      quantity: line.quantity,
      maxQty: Math.min(20, Math.max(1, product?.stockQty ?? 20))
    };
  });

  return NextResponse.json({
    ok: true,
    cart: priced.cart,
    items
  });
}
