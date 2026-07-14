import "server-only";
import type { AdminRole } from "@prisma/client";

/** Roles allowed to create/update catalog and content. */
export const CONTENT_WRITE_ROLES: AdminRole[] = ["owner", "admin", "editor"];

/** Roles allowed to delete entities or change security settings. */
export const DESTRUCTIVE_ROLES: AdminRole[] = ["owner", "admin"];

/** Roles allowed to manage orders, CRM, finance. */
export const OPERATIONS_ROLES: AdminRole[] = ["owner", "admin"];

export function hasAdminRole(role: string, allowed: AdminRole[]): boolean {
  return allowed.includes(role as AdminRole);
}
