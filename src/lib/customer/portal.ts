import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildOrderTimeline } from "@/modules/shop/services/order-ops.service";

const ACTIVE_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

export type PaginationOptions = {
  page?: number;
  pageSize?: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedList<T> = T[] & {
  pagination: PaginationMeta;
};

function normalizePagination(opts?: PaginationOptions): { skip: number; take: number; page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(opts?.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(opts?.pageSize ?? 20)));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

/**
 * HIGH-14: Added offset pagination support to customer portal overview query.
 */
export async function getPortalOverview(customerId: string, opts?: PaginationOptions) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, email: true, name: true, phone: true, emailVerifiedAt: true }
  });
  if (!customer) return null;

  if (customer.emailVerifiedAt) {
    const { linkGuestOrdersToCustomer } = await import("@/lib/customer/auth");
    await linkGuestOrdersToCustomer(customer.id, customer.email);
  }

  const { skip, take, page, pageSize } = normalizePagination(opts);

  const [total, orders] = await Promise.all([
    db.order.count({ where: { customerId, status: { in: [...ACTIVE_STATUSES] } } }),
    db.order.findMany({
      where: { customerId, status: { in: [...ACTIVE_STATUSES] } },
      include: {
        items: true,
        invoices: { select: { invoiceNumber: true, issuedAt: true, pdfUrl: true } },
        events: { orderBy: { createdAt: "asc" }, take: 8 }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    })
  ]);

  const spentCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const inTransit = orders.filter((o) => o.status === "shipped" || o.status === "processing").length;
  const latest = orders[0] ?? null;
  const recentEvents = (latest?.events ?? []).slice(-5).reverse();

  const pagination: PaginationMeta = {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1
  };

  return {
    customer,
    stats: {
      orderCount: total,
      spentCents,
      inTransit,
      formulationCount: new Set(orders.flatMap((o) => o.items.map((i) => i.productName))).size
    },
    latest,
    recentEvents,
    orders,
    pagination
  };
}

/**
 * HIGH-14: Added offset pagination support to getCustomerOrders. Returns array with attached pagination property.
 */
export async function getCustomerOrders(
  customerId: string,
  opts?: PaginationOptions
): Promise<
  PaginatedList<
    Prisma.OrderGetPayload<{
      include: {
        items: true;
        invoices: { select: { invoiceNumber: true; issuedAt: true } };
      };
    }>
  >
> {
  const { skip, take, page, pageSize } = normalizePagination(opts);

  const [total, orders] = await Promise.all([
    db.order.count({ where: { customerId } }),
    db.order.findMany({
      where: { customerId },
      include: {
        items: true,
        invoices: { select: { invoiceNumber: true, issuedAt: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    })
  ]);

  const pagination: PaginationMeta = {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1
  };

  return Object.assign(orders, { pagination });
}

export async function getCustomerOrderDetail(customerId: string, orderNumber: string) {
  const order = await db.order.findFirst({
    where: { customerId, orderNumber },
    include: {
      items: {
        include: {
          product: {
            select: {
              slug: true,
              sizeLabel: true,
              patent: { select: { title: true, applicationNumber: true } }
            }
          }
        }
      },
      invoices: true,
      events: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!order) return null;
  return { order, timeline: buildOrderTimeline(order) };
}

/**
 * HIGH-14: Added pagination support for customer documents.
 */
export async function getCustomerDocuments(customerId: string, opts?: PaginationOptions) {
  const { skip, take, page, pageSize } = normalizePagination(opts);

  const [total, orders] = await Promise.all([
    db.order.count({ where: { customerId, status: { in: [...ACTIVE_STATUSES] } } }),
    db.order.findMany({
      where: { customerId, status: { in: [...ACTIVE_STATUSES] } },
      include: {
        invoices: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                patent: { select: { title: true, applicationNumber: true, id: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    })
  ]);

  const invoices = orders.flatMap((o) =>
    o.invoices.map((inv) => ({
      kind: "invoice" as const,
      label: inv.invoiceNumber,
      orderNumber: o.orderNumber,
      at: inv.issuedAt,
      href: inv.pdfUrl || null
    }))
  );

  const productIds = [
    ...new Set(
      orders.flatMap((o) => o.items.map((i) => i.productId).filter((id): id is string => Boolean(id)))
    )
  ];
  const certificates =
    productIds.length === 0
      ? []
      : await db.certificateOfAnalysis.findMany({
          where: { productId: { in: productIds }, active: true },
          include: { product: { select: { name: true } } },
          orderBy: { issuedAt: "desc" },
          take: 40
        });

  const patents = new Map<
    string,
    { kind: "patent"; label: string; orderNumber: string; at: Date; href: string }
  >();
  for (const o of orders) {
    for (const item of o.items) {
      const p = item.product?.patent;
      if (!p) continue;
      patents.set(p.id, {
        kind: "patent",
        label: p.title,
        orderNumber: o.orderNumber,
        at: o.createdAt,
        href: `/patents`
      });
    }
  }

  const pagination: PaginationMeta = {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1
  };

  return {
    invoices,
    packingSlips: orders
      .filter((o) => o.confirmationToken)
      .map((o) => ({
        kind: "packing" as const,
        label: `Packing slip · ${o.orderNumber}`,
        orderNumber: o.orderNumber,
        at: o.createdAt,
        href: `/api/order/${o.orderNumber}/packing.pdf?t=${o.confirmationToken}`
      })),
    certificates: certificates.map((c) => ({
      kind: "coa" as const,
      label: `${c.title} · Lot ${c.lotCode}`,
      productName: c.product.name,
      at: c.issuedAt,
      href: c.fileUrl
    })),
    patents: [...patents.values()],
    orderCount: total,
    pagination
  };
}

export async function getCustomerAddresses(customerId: string) {
  return db.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
  });
}

export async function getCustomerSecurityProfile(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      email: true,
      phone: true,
      name: true,
      emailVerifiedAt: true,
      createdAt: true,
      sessions: {
        where: { isRevoked: false, expiresAt: { gt: new Date() } },
        orderBy: { lastUsedAt: "desc" },
        take: 8,
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          lastUsedAt: true,
          createdAt: true
        }
      }
    }
  });
  return customer;
}
