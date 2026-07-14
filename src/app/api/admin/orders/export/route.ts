import { requireAdminRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true }
  });

  const csv = toCsv(
    [
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
    ],
    orders.map((o) => [
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
    ])
  );

  return csvResponse(csv, "orders-{date}.csv");
}
