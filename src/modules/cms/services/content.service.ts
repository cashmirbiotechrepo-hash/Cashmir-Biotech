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
    db.product.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 3 }),
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
  return db.product.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
}

export async function listPatents() {
  return db.patent.findMany({ orderBy: { publishedAt: "desc" } });
}

export async function listTeamMembers() {
  return db.teamMember.findMany({ orderBy: { sortOrder: "asc" } });
}
