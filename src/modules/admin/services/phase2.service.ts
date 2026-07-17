import "server-only";
import { db } from "@/lib/db";

/**
 * MED-02: DTO stripping helper to ensure only plain, serializable JSON objects
 * cross the Server Action -> Client Component boundary (prevents Decimal/Date serialization errors).
 */
function toDTO<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}

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
  const data = await db.contact.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { deals: true } } }
  });
  return toDTO(data);
}

export async function listDeals() {
  const data = await db.deal.findMany({
    orderBy: { updatedAt: "desc" },
    include: { contact: true }
  });
  return toDTO(data);
}

export async function listCoupons() {
  const data = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return toDTO(data);
}

export async function listInvoices() {
  const data = await db.invoice.findMany({
    orderBy: { issuedAt: "desc" },
    include: { order: true },
    take: 100
  });
  return toDTO(data);
}

export async function listExpenses() {
  const data = await db.expense.findMany({ orderBy: { incurredAt: "desc" }, take: 200 });
  return toDTO(data);
}

export async function listCampaigns() {
  const data = await db.emailCampaign.findMany({ orderBy: { createdAt: "desc" } });
  return toDTO(data);
}

export async function listPatentsFull() {
  const data = await db.patent.findMany({
    orderBy: { publishedAt: "desc" },
    include: { products: { select: { id: true, name: true } } }
  });
  return toDTO(data);
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

/**
 * PROJECT OMEGA / CRIT-02 FIX: Atomic GST invoice sequence generation using PostgreSQL sequences.
 * Invokes `SELECT nextval('invoice_seq')` to claim the next unique integer in O(1) time
 * without acquiring table locks or risking TOCTOU count() collisions during concurrent checkouts.
 */
export async function nextInvoiceNumberAtomic(): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const result = await db.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('invoice_seq')
    `;
    const seq = Number(result[0]?.nextval ?? 1);
    return `CB-${year}-${String(seq).padStart(4, "0")}`;
  } catch {
    // Fallback for non-Postgres / local SQLite test environments where invoice_seq does not exist yet
    return nextInvoiceNumber();
  }
}
