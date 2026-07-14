import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { clientIpFromRequest } from "@/lib/rate-limit-edge";

export async function writeAuditLog(input: {
  userEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  diff?: Prisma.InputJsonValue;
  ipAddress?: string;
}) {
  let ipAddress = input.ipAddress;
  if (!ipAddress) {
    try {
      const h = await headers();
      ipAddress = clientIpFromRequest({ headers: h } as Request);
    } catch {
      ipAddress = undefined;
    }
  }

  return db.auditLog.create({
    data: {
      userEmail: input.userEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      diff: input.diff,
      ipAddress
    }
  });
}

export type AuditLogFilters = {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  userEmail?: string;
  from?: string;
  to?: string;
};

export async function listAuditLogs(filters: AuditLogFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = buildAuditWhere(filters);

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.auditLog.count({ where })
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/** Unbounded (capped) export path — not subject to the UI pageSize clamp of 100. */
export async function exportAuditLogs(
  filters: Omit<AuditLogFilters, "page" | "pageSize"> & { limit?: number }
) {
  const limit = Math.min(Math.max(1, filters.limit ?? 10_000), 10_000);
  return db.auditLog.findMany({
    where: buildAuditWhere(filters),
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

function buildAuditWhere(filters: Omit<AuditLogFilters, "page" | "pageSize">): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) where.action = { contains: filters.action, mode: "insensitive" };
  if (filters.entityType) where.entityType = { contains: filters.entityType, mode: "insensitive" };
  if (filters.userEmail) where.userEmail = { contains: filters.userEmail, mode: "insensitive" };

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  return where;
}

export async function listRecentSecurityEvents(limit = 8) {
  return db.auditLog.findMany({
    where: {
      action: {
        in: [
          "login",
          "logout",
          "account_locked",
          "revoke_sessions",
          "revoke_session",
          "change_password",
          "reset_password",
          "enable_2fa",
          "disable_2fa"
        ]
      }
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
