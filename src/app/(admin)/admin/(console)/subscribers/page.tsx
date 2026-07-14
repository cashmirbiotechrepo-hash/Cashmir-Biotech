import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";
import { DESTRUCTIVE_ROLES, hasAdminRole } from "@/lib/admin/rbac";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { SubscribersTable } from "@/components/admin/subscribers-table";
import { AdminListToolbar } from "@/components/admin/list-toolbar";
import { AdminPagination } from "@/components/admin/pagination";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Subscribers" };

const PAGE_SIZE = 50;

export default async function AdminSubscribersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status === "subscribed" || sp.status === "unsubscribed" ? sp.status : "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const admin = await getCurrentAdmin();
  const canDelete = admin ? hasAdminRole(admin.role, DESTRUCTIVE_ROLES) : false;

  const where: Prisma.SubscriberWhereInput = {
    ...(q ? { email: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status } : {})
  };

  const [subscribers, total] = await Promise.all([
    db.subscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    db.subscriber.count({ where })
  ]);

  return (
    <>
      <AdminPageHeader
        title="Subscribers"
        description="Institutional access requests from the homepage newsletter form."
        actions={
          <Link href="/api/admin/subscribers/export" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Export CSV
          </Link>
        }
      />

      <AdminListToolbar
        searchPlaceholder="Search email…"
        filters={[
          {
            name: "status",
            value: status,
            options: [
              { label: "All", value: "" },
              { label: "Subscribed", value: "subscribed" },
              { label: "Unsubscribed", value: "unsubscribed" }
            ]
          }
        ]}
      />

      {subscribers.length === 0 && !q && !status ? (
        <EmptyState
          title="No subscribers yet"
          description="Emails collected from the homepage newsletter will appear here."
        />
      ) : (
        <>
          <SubscribersTable subscribers={subscribers} canDelete={canDelete} />
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </>
  );
}
