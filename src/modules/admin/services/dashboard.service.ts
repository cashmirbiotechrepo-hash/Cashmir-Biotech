import "server-only";
import { db } from "@/lib/db";

export type AdminDashboardStats = {
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
  couponsPendingStorefront: number;
};

export async function getDashboardStats(): Promise<AdminDashboardStats> {
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
    couponsPendingStorefront,
    lowStockRaw
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { active: true } }),
    db.order.count(),
    db.order.count({ where: { status: "pending" } }),
    db.order.aggregate({
      where: { status: { in: ["paid", "processing", "shipped", "delivered"] } },
      _sum: { totalCents: true }
    }),
    db.patent.count(),
    db.subscriber.count(),
    db.teamMember.count(),
    db.deal.aggregate({
      where: { stage: { notIn: ["won", "lost"] } },
      _count: { _all: true },
      _sum: { valueCents: true }
    }),
    db.coupon.count({ where: { active: true } }),
    // MED-01: DB-level low stock count via raw query
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM "Inventory"
      WHERE ("quantityOnHand" - "quantityReserved") <= "lowStockThreshold"
    `
  ]);

  const lowStockCount = Number(lowStockRaw[0]?.count ?? 0);

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
    openDeals: pipeline._count._all ?? 0,
    pipelineValueInr: Math.round((pipeline._sum?.valueCents ?? 0) / 100),
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

export type LowStockProductRow = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
  quantityOnHand: number;
  quantityReserved: number;
};

/**
 * MED-01: DB-level low stock query with SQL sorting and limit to avoid loading all rows into JS memory.
 */
export async function listLowStockProducts(limit = 6): Promise<LowStockProductRow[]> {
  const rows = await db.$queryRaw<
    {
      productId: string;
      name: string;
      slug: string;
      imageUrl: string;
      sku: string | null;
      productSku: string | null;
      quantityOnHand: number;
      quantityReserved: number;
      lowStockThreshold: number;
    }[]
  >`
    SELECT 
      i."productId",
      p.name,
      p.slug,
      p."imageUrl",
      i.sku,
      p.sku as "productSku",
      i."quantityOnHand",
      i."quantityReserved",
      i."lowStockThreshold"
    FROM "Inventory" i
    JOIN "Product" p ON p.id = i."productId"
    WHERE (i."quantityOnHand" - i."quantityReserved") <= i."lowStockThreshold"
    ORDER BY (i."quantityOnHand" - i."quantityReserved") ASC
    LIMIT ${limit}
  `;

  return rows.map((r) => {
    const available = r.quantityOnHand - r.quantityReserved;
    return {
      id: r.productId,
      name: r.name,
      slug: r.slug,
      imageUrl: r.imageUrl,
      sku: r.sku || r.productSku || "",
      stockQty: available,
      lowStockThreshold: r.lowStockThreshold,
      quantityOnHand: r.quantityOnHand,
      quantityReserved: r.quantityReserved
    };
  });
}
