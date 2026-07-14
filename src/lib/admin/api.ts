import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

export function adminOk<T>(data: T) {
  return NextResponse.json({ data });
}

export function adminErr(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function requireAdminApi() {
  const admin = await getCurrentAdmin();
  if (!admin?.email) {
    return { admin: null as null, error: adminErr("unauthorized", "Admin session required.", 401) };
  }
  return { admin, error: null as null };
}

export async function requireAdminRole(roles: Array<"owner" | "admin" | "editor">) {
  const { admin, error } = await requireAdminApi();
  if (error) return { admin: null as null, error };
  if (!roles.includes(admin.role as "owner" | "admin" | "editor")) {
    return { admin: null as null, error: adminErr("forbidden", "Insufficient permissions.", 403) };
  }
  return { admin, error: null as null };
}
