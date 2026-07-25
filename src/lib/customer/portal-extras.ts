import "server-only";

import { db } from "@/lib/db";
import { listOrgMembershipsForCustomer } from "@/modules/shop/services/org-invite.service";
import { getActiveCircleSubscription } from "@/modules/shop/services/research-circle.service";

export async function getPortalMembershipFlags(customerId: string) {
  const [memberships, circle] = await Promise.all([
    listOrgMembershipsForCustomer(customerId),
    getActiveCircleSubscription(customerId)
  ]);
  return {
    hasOrg: memberships.length > 0,
    hasCircle: Boolean(circle)
  };
}

export function parseLotCodes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[,;|/]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ];
}

export type OrderCoaLine = {
  productId: string;
  productName: string;
  lotCodes: string[];
  certificates: Array<{ id: string; title: string; lotCode: string; fileUrl: string }>;
};

/** Lot-preferring CoAs for a single owned order. */
export async function getOrderCoaLines(
  customerId: string,
  orderNumber: string
): Promise<OrderCoaLine[] | null> {
  const order = await db.order.findFirst({
    where: { customerId, orderNumber },
    include: {
      items: {
        select: {
          productId: true,
          productName: true,
          lotCodes: true
        }
      }
    }
  });
  if (!order) return null;

  const productIds = [
    ...new Set(order.items.map((i) => i.productId).filter((id): id is string => Boolean(id)))
  ];
  if (productIds.length === 0) return [];

  const certificates = await db.certificateOfAnalysis.findMany({
    where: { productId: { in: productIds }, active: true },
    select: {
      id: true,
      productId: true,
      title: true,
      lotCode: true,
      fileUrl: true
    },
    orderBy: { issuedAt: "desc" },
    take: 80
  });

  return order.items
    .filter((i) => i.productId)
    .map((item) => {
      const lots = parseLotCodes(item.lotCodes);
      const forProduct = certificates.filter((c) => c.productId === item.productId);
      let matched =
        lots.length > 0
          ? forProduct.filter((c) =>
              lots.some((l) => l.toLowerCase() === c.lotCode.toLowerCase())
            )
          : forProduct;
      // No lot-exact match yet — still surface product CoAs if published (lab may use alternate codes)
      if (matched.length === 0) matched = forProduct.slice(0, 3);
      return {
        productId: item.productId!,
        productName: item.productName,
        lotCodes: lots,
        certificates: matched.map((c) => ({
          id: c.id,
          title: c.title,
          lotCode: c.lotCode,
          fileUrl: c.fileUrl
        }))
      };
    });
}
