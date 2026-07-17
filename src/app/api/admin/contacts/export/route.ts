import { requireAdminRole } from "@/lib/admin/api";
import { cursorPages, streamCsvResponse } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const header = ["name", "email", "company", "phone", "type", "deals", "createdAt"];

  async function* rows() {
    for await (const c of cursorPages((args) =>
      db.contact.findMany({
        ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
        take: args.take,
        orderBy: { id: "desc" },
        include: { _count: { select: { deals: true } } }
      })
    )) {
      yield [
        c.name,
        c.email ?? "",
        c.company,
        c.phone,
        c.type,
        c._count.deals,
        c.createdAt.toISOString()
      ];
    }
  }

  return streamCsvResponse("contacts-{date}.csv", header, rows());
}
