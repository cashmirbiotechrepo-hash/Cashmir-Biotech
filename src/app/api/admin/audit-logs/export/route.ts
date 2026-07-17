import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/api";
import { cursorPages, streamCsvResponse } from "@/lib/admin/csv";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const { admin, error } = await requireAdminRole(["owner", "admin"]);
  if (error || !admin) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const where: Prisma.AuditLogWhereInput = {};
  const action = url.searchParams.get("action");
  const entityType = url.searchParams.get("entityType");
  const userEmail = url.searchParams.get("userEmail");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entityType) where.entityType = { contains: entityType, mode: "insensitive" };
  if (userEmail) where.userEmail = { contains: userEmail, mode: "insensitive" };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const header = ["createdAt", "userEmail", "action", "entityType", "entityId", "ipAddress", "diff"];

  async function* rows() {
    for await (const log of cursorPages((args) =>
      db.auditLog.findMany({
        where,
        ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
        take: args.take,
        orderBy: { id: "desc" }
      })
    )) {
      yield [
        log.createdAt.toISOString(),
        log.userEmail,
        log.action,
        log.entityType,
        log.entityId ?? "",
        log.ipAddress ?? "",
        log.diff ? JSON.stringify(log.diff) : ""
      ];
    }
  }

  return streamCsvResponse("audit-logs-{date}.csv", header, rows());
}
