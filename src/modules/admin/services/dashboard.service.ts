import "server-only";
import { db } from "@/lib/db";

export type DashboardStats = {
  products: number;
  activeProducts: number;
  lowStock: number;
  orders: number;
  pendingOrders: number;
  revenueInr: number;
  patents: number;
  subscribers: number;
  teamMembers: number;
  openDeals: number;
  pipelineValueInr: number;
  /** Coupons exist in admin but are not wired to storefront checkout yet. */
  couponsPendingStorefront: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    products,
    activeProducts,
    orders,
    pendingOrders,
    revenueAgg,
    patents,
    subscribers,
    teamMembers,
    pipeline,
    couponsPendingStorefront
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { active: true } }),
    db.order.count(),
    db.order.count({ where: { status: { in: ["pending", "paid", "processing"] } } }),
    db.order.aggregate({
      where: { status: { in: ["paid", "processing", "shipped", "delivered"] } },
      _sum: { totalCents: true }
    }),
    db.patent.count(),
    db.subscriber.count(),
    db.teamMember.count(),
    db.deal.aggregate({
      where: { stage: { in: ["lead", "qualified", "proposal"] } },
      _sum: { valueCents: true },
      _count: true
    }),
    db.coupon.count({ where: { active: true } })
  ]);

  // Match Inventory screen: available = onHand − reserved
  const inventoryRows = await db.inventory.findMany({
    select: { quantityOnHand: true, quantityReserved: true, lowStockThreshold: true }
  });
  const lowStockCount = inventoryRows.filter(
    (r) => r.quantityOnHand - r.quantityReserved <= r.lowStockThreshold
  ).length;

  return {
    products,
    activeProducts,
    lowStock: lowStockCount,
    orders,
    pendingOrders,
    revenueInr: Math.round((revenueAgg._sum.totalCents ?? 0) / 100),
    patents,
    subscribers,
    teamMembers,
    openDeals: pipeline._count,
    pipelineValueInr: Math.round((pipeline._sum.valueCents ?? 0) / 100),
    couponsPendingStorefront
  };
}

export async function listRecentOrders(limit = 8) {
  return db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { items: true }
  });
}

export async function listLowStockProducts(limit = 6) {
  const rows = await db.inventory.findMany({
    include: { product: { select: { id: true, name: true, slug: true, imageUrl: true, sku: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100
  });

  return rows
    .map((r) => {
      const available = r.quantityOnHand - r.quantityReserved;
      return {
        id: r.productId,
        name: r.product.name,
        slug: r.product.slug,
        imageUrl: r.product.imageUrl,
        sku: r.sku || r.product.sku,
        stockQty: available,
        lowStockThreshold: r.lowStockThreshold,
        quantityOnHand: r.quantityOnHand,
        quantityReserved: r.quantityReserved
      };
    })
    .filter((p) => p.stockQty <= p.lowStockThreshold)
    .sort((a, b) => a.stockQty - b.stockQty)
    .slice(0, limit);
}
