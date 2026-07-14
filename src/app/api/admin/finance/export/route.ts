import { requireAdminRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({ orderBy: { issuedAt: "desc" }, include: { order: true } }),
    db.expense.findMany({ orderBy: { incurredAt: "desc" } })
  ]);

  const invoiceCsv = toCsv(
    ["type", "reference", "order", "subtotalINR", "taxINR", "totalINR", "date"],
    invoices.map((i) => [
      "invoice",
      i.invoiceNumber,
      i.order?.orderNumber ?? "",
      (i.subtotalCents / 100).toFixed(2),
      (i.taxCents / 100).toFixed(2),
      (i.totalCents / 100).toFixed(2),
      i.issuedAt.toISOString()
    ])
  );

  const expenseCsv = toCsv(
    ["type", "title", "category", "amountINR", "gstINR", "vendor", "date"],
    expenses.map((e) => [
      "expense",
      e.title,
      e.category,
      (e.amountCents / 100).toFixed(2),
      (e.gstCents / 100).toFixed(2),
      e.vendor,
      e.incurredAt.toISOString()
    ])
  );

  const csv = `${invoiceCsv}\n\nEXPENSES\n${expenseCsv}`;

  return csvResponse(csv, "finance-{date}.csv");
}
