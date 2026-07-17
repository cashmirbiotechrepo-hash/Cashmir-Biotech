import { requireAdminRole } from "@/lib/admin/api";
import { cursorPages, streamCsvResponse } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const header = [
    "type",
    "reference",
    "order",
    "subtotalINR",
    "taxINR",
    "totalINR",
    "title",
    "category",
    "amountINR",
    "gstINR",
    "vendor",
    "date"
  ];

  async function* rows() {
    for await (const i of cursorPages((args) =>
      db.invoice.findMany({
        ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
        take: args.take,
        orderBy: { id: "desc" },
        include: { order: true }
      })
    )) {
      yield [
        "invoice",
        i.invoiceNumber,
        i.order?.orderNumber ?? "",
        (i.subtotalCents / 100).toFixed(2),
        (i.taxCents / 100).toFixed(2),
        (i.totalCents / 100).toFixed(2),
        "",
        "",
        "",
        "",
        "",
        i.issuedAt.toISOString()
      ];
    }

    for await (const e of cursorPages((args) =>
      db.expense.findMany({
        ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
        take: args.take,
        orderBy: { id: "desc" }
      })
    )) {
      yield [
        "expense",
        "",
        "",
        "",
        "",
        "",
        e.title,
        e.category,
        (e.amountCents / 100).toFixed(2),
        (e.gstCents / 100).toFixed(2),
        e.vendor,
        e.incurredAt.toISOString()
      ];
    }
  }

  return streamCsvResponse("finance-{date}.csv", header, rows());
}
