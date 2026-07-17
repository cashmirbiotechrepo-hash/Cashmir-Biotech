import { requireAdminRole } from "@/lib/admin/api";
import { cursorPages, streamCsvResponse } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const header = [
    "orderNumber",
    "status",
    "customerName",
    "customerEmail",
    "items",
    "subtotalINR",
    "taxINR",
    "shippingINR",
    "totalINR",
    "trackingNumber",
    "carrier",
    "createdAt"
  ];

  async function* rows() {
    for await (const o of cursorPages((args) =>
      db.order.findMany({
        ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
        take: args.take,
        orderBy: { id: "desc" },
        include: { items: true }
      })
    )) {
      yield [
        o.orderNumber,
        o.status,
        o.customerName ?? "",
        o.customerEmail ?? "",
        o.items.reduce((n, i) => n + i.quantity, 0),
        (o.subtotalCents / 100).toFixed(2),
        (o.taxCents / 100).toFixed(2),
        (o.shippingCents / 100).toFixed(2),
        (o.totalCents / 100).toFixed(2),
        o.trackingNumber,
        o.carrier,
        o.createdAt.toISOString()
      ];
    }
  }

  return streamCsvResponse("orders-{date}.csv", header, rows());
}
