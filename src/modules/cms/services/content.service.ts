import "server-only";
import { db } from "@/lib/db";
import type { Patent, Product, SiteSettings, TeamMember } from "@prisma/client";

export type PublicHomeData = {
  settings: SiteSettings | null;
  products: Product[];
  patents: Patent[];
};

export async function getPublicHomeContent(): Promise<PublicHomeData> {
  const [settings, products, patents] = await Promise.all([
    db.siteSettings.findUnique({ where: { id: 1 } }),
    db.product.findMany({
      where: { active: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 6
    }),
    db.patent.findMany({ orderBy: { publishedAt: "desc" }, take: 3 })
  ]);
  return { settings, products, patents };
}

export type DashboardContent = {
  settings: SiteSettings | null;
  products: Product[];
  patents: Patent[];
  team: TeamMember[];
};

export async function getDashboardContent(): Promise<DashboardContent> {
  const [settings, products, patents, team] = await Promise.all([
    db.siteSettings.findUnique({ where: { id: 1 } }),
    db.product.findMany({ orderBy: { createdAt: "desc" } }),
    db.patent.findMany({ orderBy: { publishedAt: "desc" } }),
    db.teamMember.findMany({ orderBy: { sortOrder: "asc" } })
  ]);
  return { settings, products, patents, team };
}

export async function upsertHomepageContent(input: {
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  ctaPrimaryText: string;
  ctaPrimaryHref: string;
  ctaSecondaryText: string;
  ctaSecondaryHref: string;
  missionStatement: string;
}) {
  return db.siteSettings.upsert({
    where: { id: 1 },
    update: { ...input },
    create: {
      id: 1,
      companyName: "Cashmir Biotech",
      ...input
    }
  });
}

export async function upsertShippingSettings(input: {
  flatShippingInr: number;
  freeShippingThresholdInr: number;
}) {
  const result = await db.siteSettings.upsert({
    where: { id: 1 },
    update: {
      flatShippingInr: input.flatShippingInr,
      freeShippingThresholdInr: input.freeShippingThresholdInr
    },
    create: {
      id: 1,
      companyName: "Cashmir Biotech",
      heroTitle: "The architecture of daily vitality",
      heroSubtitle: "Proven biotech innovation from Kashmir biodiversity",
      heroDescription:
        "Premium supplements with scientific discipline, patent-backed innovation, and research-grade manufacturing standards.",
      ctaPrimaryText: "Explore Catalog",
      ctaPrimaryHref: "/products",
      ctaSecondaryText: "View Patents",
      ctaSecondaryHref: "/patents",
      missionStatement:
        "A mission to treat disorders with healthy, non-toxic, safe and accessible designer foods powered by biotechnology.",
      flatShippingInr: input.flatShippingInr,
      freeShippingThresholdInr: input.freeShippingThresholdInr
    }
  });
  const { invalidateShippingRatesCache } = await import("@/modules/shop/services/pricing.service");
  invalidateShippingRatesCache();
  return result;
}

export async function getShippingSettings() {
  const settings = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: { flatShippingInr: true, freeShippingThresholdInr: true }
  });
  return {
    flatShippingInr: settings?.flatShippingInr ?? 60,
    freeShippingThresholdInr: settings?.freeShippingThresholdInr ?? 999
  };
}

export async function updateProductContent(
  id: string,
  data: {
    name: string;
    shortBenefit: string;
    description: string;
    mrpInr: number;
    sizeLabel: string;
    imageUrl: string;
  }
) {
  return db.product.update({
    where: { id },
    data
  });
}

export async function updatePatentContent(
  id: string,
  data: { title: string; summary: string; status: string }
) {
  return db.patent.update({
    where: { id },
    data
  });
}

export async function updateTeamMemberContent(
  id: string,
  data: { fullName: string; role: string; bio: string; avatarUrl: string }
) {
  return db.teamMember.update({
    where: { id },
    data
  });
}

export async function listActiveProducts() {
  return db.product.findMany({
    where: { active: true },
    include: {
      patent: { select: { patentCode: true, title: true } }
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }]
  });
}

export type ProductAvailability = {
  /** Units a customer can actually order right now (on-hand minus reserved, or stockQty if untracked). */
  available: number;
  isLow: boolean;
  tracked: boolean;
};

/** Live orderable quantity for a product, honouring inventory reservations. */
export async function getProductAvailability(product: {
  id: string;
  stockQty: number;
  lowStockThreshold: number;
  hasInventoryTracking: boolean;
}): Promise<ProductAvailability> {
  if (!product.hasInventoryTracking) {
    return { available: product.stockQty, isLow: false, tracked: false };
  }
  const inv = await db.inventory.findUnique({ where: { productId: product.id } });
  const available = inv
    ? Math.max(0, inv.quantityOnHand - inv.quantityReserved)
    : product.stockQty;
  const threshold = inv?.lowStockThreshold ?? product.lowStockThreshold;
  return { available, isLow: available > 0 && available <= threshold, tracked: true };
}

export async function getActiveProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, active: true },
    include: {
      patent: {
        select: {
          id: true,
          patentCode: true,
          title: true,
          summary: true,
          status: true,
          jurisdiction: true,
          lifecycleStatus: true
        }
      }
    }
  });
}

export async function listActiveProductSlugs() {
  return db.product.findMany({ where: { active: true }, select: { slug: true } });
}

export async function listPatents() {
  return db.patent.findMany({ orderBy: { publishedAt: "desc" } });
}

export async function listTeamMembers() {
  return db.teamMember.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function listPublishedPosts() {
  return db.blogPost.findMany({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getPublishedPost(slug: string) {
  return db.blogPost.findFirst({ where: { slug, status: "published" } });
}
