import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { requireAdminRole } from "@/lib/auth";
import { listAuditLogs } from "@/modules/admin/services/audit.service";

export const metadata = { title: "Audit logs" };

type SearchParams = Promise<{
  page?: string;
  action?: string;
  entityType?: string;
  userEmail?: string;
  from?: string;
  to?: string;
}>;

export default async function AdminAuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminRole(["owner", "admin"]);
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const result = await listAuditLogs({
    page,
    action: params.action,
    entityType: params.entityType,
    userEmail: params.userEmail,
    from: params.from,
    to: params.to
  });

  const buildUrl = (nextPage: number) => {
    const q = new URLSearchParams();
    if (params.action) q.set("action", params.action);
    if (params.entityType) q.set("entityType", params.entityType);
    if (params.userEmail) q.set("userEmail", params.userEmail);
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    q.set("page", String(nextPage));
    return `/admin/audit-logs?${q.toString()}`;
  };

  const exportQuery = new URLSearchParams();
  if (params.action) exportQuery.set("action", params.action);
  if (params.entityType) exportQuery.set("entityType", params.entityType);
  if (params.userEmail) exportQuery.set("userEmail", params.userEmail);
  if (params.from) exportQuery.set("from", params.from);
  if (params.to) exportQuery.set("to", params.to);

  return (
    <>
      <AdminPageHeader
        title="Audit logs"
        description="Immutable trail of admin actions — logins, content changes, and security events."
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" action="/admin/audit-logs" method="get">
            <Input name="userEmail" placeholder="User email" defaultValue={params.userEmail ?? ""} />
            <Input name="action" placeholder="Action" defaultValue={params.action ?? ""} />
            <Input name="entityType" placeholder="Entity type" defaultValue={params.entityType ?? ""} />
            <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="From date" />
            <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="To date" />
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Link
                href={`/api/admin/audit-logs/export?${exportQuery.toString()}`}
                className={buttonVariants({ variant: "outline", size: "default" })}
              >
                Export CSV
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="No audit entries" description="Actions will appear here as admins use the console." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-sm">{log.userEmail}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{log.entityType}</span>
                      {log.entityId ? (
                        <span className="ml-1 font-mono text-xs">{log.entityId.slice(0, 12)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {log.diff ? JSON.stringify(log.diff) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {result.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {result.page} of {result.totalPages} ({result.total} entries)
          </span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link href={buildUrl(result.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Previous
              </Link>
            ) : null}
            {result.page < result.totalPages ? (
              <Link href={buildUrl(result.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
