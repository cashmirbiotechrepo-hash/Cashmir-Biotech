import "server-only";

import { db } from "@/lib/db";

export async function listWishlist(customerId: string) {
  return db.customerWishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          sizeLabel: true,
          imageUrl: true,
          active: true,
          mrpInr: true,
          pricePaise: true,
          maxOrderQty: true,
          stockQty: true
        }
      }
    }
  });
}

export async function isProductWishlisted(customerId: string, productId: string) {
  const row = await db.customerWishlistItem.findUnique({
    where: { customerId_productId: { customerId, productId } },
    select: { id: true }
  });
  return Boolean(row);
}

export async function toggleWishlistItem(
  customerId: string,
  productId: string
): Promise<{ wishlisted: boolean }> {
  const product = await db.product.findFirst({
    where: { id: productId, active: true },
    select: { id: true }
  });
  if (!product) {
    throw new Error("Product not found.");
  }

  const existing = await db.customerWishlistItem.findUnique({
    where: { customerId_productId: { customerId, productId } }
  });

  if (existing) {
    await db.customerWishlistItem.delete({ where: { id: existing.id } });
    return { wishlisted: false };
  }

  await db.customerWishlistItem.create({
    data: { customerId, productId }
  });
  return { wishlisted: true };
}

export async function removeWishlistItem(customerId: string, productId: string) {
  await db.customerWishlistItem.deleteMany({ where: { customerId, productId } });
}
