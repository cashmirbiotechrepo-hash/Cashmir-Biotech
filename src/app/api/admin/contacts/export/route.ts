import { requireAdminRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const contacts = await db.contact.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deals: true } } }
  });

  const csv = toCsv(
    ["name", "email", "company", "phone", "type", "deals", "createdAt"],
    contacts.map((c) => [
      c.name,
      c.email ?? "",
      c.company,
      c.phone,
      c.type,
      c._count.deals,
      c.createdAt.toISOString()
    ])
  );

  return csvResponse(csv, "contacts-{date}.csv");
}
