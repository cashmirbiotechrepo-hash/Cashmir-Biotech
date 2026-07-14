import "server-only";
import { db } from "@/lib/db";

export async function getCrmSummary() {
  const [contacts, deals, pipeline] = await Promise.all([
    db.contact.count(),
    db.deal.count(),
    db.deal.aggregate({
      where: { stage: { in: ["lead", "qualified", "proposal"] } },
      _sum: { valueCents: true },
      _count: true
    })
  ]);
  return {
    contacts,
    deals,
    openDeals: pipeline._count,
    pipelineValueInr: Math.round((pipeline._sum.valueCents ?? 0) / 100)
  };
}

export async function listContacts() {
  return db.contact.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { deals: true } } }
  });
}

export async function listDeals() {
  return db.deal.findMany({
    orderBy: { updatedAt: "desc" },
    include: { contact: true }
  });
}

export async function listCoupons() {
  return db.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function listInvoices() {
  return db.invoice.findMany({
    orderBy: { issuedAt: "desc" },
    include: { order: true },
    take: 100
  });
}

export async function listExpenses() {
  return db.expense.findMany({ orderBy: { incurredAt: "desc" }, take: 200 });
}

export async function listCampaigns() {
  return db.emailCampaign.findMany({ orderBy: { createdAt: "desc" } });
}

export async function listPatentsFull() {
  return db.patent.findMany({
    orderBy: { publishedAt: "desc" },
    include: { products: { select: { id: true, name: true } } }
  });
}

export function parseInventors(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // fall through — comma-separated
  }
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function inventorsToText(inventors: unknown): string {
  if (Array.isArray(inventors)) return inventors.join(", ");
  return "";
}

export async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await db.invoice.count({
    where: { issuedAt: { gte: new Date(`${year}-01-01`) } }
  });
  return `CB-${year}-${String(count + 1).padStart(4, "0")}`;
}
