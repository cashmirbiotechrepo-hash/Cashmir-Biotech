import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { exportAuditLogs } from "@/modules/admin/services/audit.service";

export async function GET(request: Request) {
  const { admin, error } = await requireAdminRole(["owner", "admin"]);
  if (error || !admin) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const items = await exportAuditLogs({
    action: url.searchParams.get("action") ?? undefined,
    entityType: url.searchParams.get("entityType") ?? undefined,
    userEmail: url.searchParams.get("userEmail") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: 10_000
  });

  const csv = toCsv(
    ["createdAt", "userEmail", "action", "entityType", "entityId", "ipAddress", "diff"],
    items.map((log) => [
      log.createdAt.toISOString(),
      log.userEmail,
      log.action,
      log.entityType,
      log.entityId ?? "",
      log.ipAddress ?? "",
      log.diff ? JSON.stringify(log.diff) : ""
    ])
  );

  return csvResponse(csv, `audit-logs-{date}.csv`);
}
