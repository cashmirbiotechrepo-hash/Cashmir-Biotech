import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrdersTable } from "@/components/admin/orders-table";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminListToolbar } from "@/components/admin/list-toolbar";
import { AdminPagination } from "@/components/admin/pagination";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Orders" };

const STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "payment_failed",
  "refunded"
];

const PAGE_SIZE = 25;

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status && STATUSES.includes(sp.status) ? sp.status : "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as Prisma.OrderWhereInput["status"] } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q, mode: "insensitive" } },
            { trackingNumber: { contains: q, mode: "insensitive" } },
            { razorpayPaymentId: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [orders, total, statusCounts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true, invoices: { select: { id: true, invoiceNumber: true }, take: 1 } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    db.order.count({ where }),
    db.order.groupBy({
      by: ["status"],
      _count: true
    })
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));
  const allCount = statusCounts.reduce((sum, s) => sum + s._count, 0);

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Operations command center — documents, fulfillment, timeline, and customer context."
        actions={
          <Link href="/api/admin/orders/export" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Export CSV
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {[
          { label: "All", value: "", n: allCount },
          ...STATUSES.map((s) => ({ label: s, value: s, n: countMap[s] ?? 0 }))
        ].map((chip) => (
          <Link
            key={chip.label}
            href={
              chip.value
                ? `/admin/orders?status=${chip.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`
                : `/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ""}`
            }
            className={`rounded-full border px-3 py-1 capitalize ${
              status === chip.value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            {chip.label}
            <span className="ml-1.5 tabular-nums opacity-70">{chip.n}</span>
          </Link>
        ))}
      </div>

      <AdminListToolbar
        searchPlaceholder="Search order #, name, email, phone, tracking…"
        filters={[
          {
            name: "status",
            value: status,
            options: [{ label: "All statuses", value: "" }, ...STATUSES.map((s) => ({ label: s, value: s }))]
          }
        ]}
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={
            q || status
              ? "No orders match your filters. Try clearing them."
              : "Orders will appear here once checkout and payment webhooks are connected."
          }
        />
      ) : (
        <>
          <OrdersTable orders={orders} />
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </>
  );
}
