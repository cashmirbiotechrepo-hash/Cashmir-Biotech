import "server-only";
import { db } from "@/lib/db";
import { buildOrderTimeline } from "@/modules/shop/services/order-ops.service";

const ACTIVE_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

export async function getPortalOverview(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, email: true, name: true, phone: true, emailVerifiedAt: true }
  });
  if (!customer) return null;

  if (customer.emailVerifiedAt) {
    const { linkGuestOrdersToCustomer } = await import("@/lib/customer/auth");
    await linkGuestOrdersToCustomer(customer.id, customer.email);
  }

  const orders = await db.order.findMany({
    where: { customerId, status: { in: [...ACTIVE_STATUSES] } },
    include: {
      items: true,
      invoices: { select: { invoiceNumber: true, issuedAt: true, pdfUrl: true } },
      events: { orderBy: { createdAt: "asc" }, take: 8 }
    },
    orderBy: { createdAt: "desc" }
  });

  const spentCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const inTransit = orders.filter((o) => o.status === "shipped" || o.status === "processing").length;
  const latest = orders[0] ?? null;
  const recentEvents = (latest?.events ?? []).slice(-5).reverse();

  return {
    customer,
    stats: {
      orderCount: orders.length,
      spentCents,
      inTransit,
      formulationCount: new Set(orders.flatMap((o) => o.items.map((i) => i.productName))).size
    },
    latest,
    recentEvents,
    orders
  };
}

export async function getCustomerOrders(customerId: string) {
  return db.order.findMany({
    where: { customerId },
    include: {
      items: true,
      invoices: { select: { invoiceNumber: true, issuedAt: true } }
    },
    orderBy: { createdAt: "desc" }
  });
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

export async function getCustomerDocuments(customerId: string) {
  const orders = await db.order.findMany({
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
    orderBy: { createdAt: "desc" }
  });

  const invoices = orders.flatMap((o) =>
    o.invoices.map((inv) => ({
      kind: "invoice" as const,
      label: inv.invoiceNumber,
      orderNumber: o.orderNumber,
      at: inv.issuedAt,
      href: inv.pdfUrl || null
    }))
  );

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

  return {
    invoices,
    patents: [...patents.values()],
    orderCount: orders.length
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
      passwordHash: true,
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
