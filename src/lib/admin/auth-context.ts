import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/config/auth.constants";
import { decryptToken } from "@/lib/admin/encryption";
import { AdminTokenService, type AdminTokenPayload } from "@/lib/admin/tokens";
import { AdminAuthService } from "@/lib/admin/auth-service";
import { db } from "@/lib/db";

export type RequestAdmin = AdminTokenPayload & {
  id: string;
  email: string;
  role: string;
};

async function decryptAndVerify(encrypted: string): Promise<RequestAdmin | null> {
  let jwt: string;
  try {
    jwt = await decryptToken(encrypted);
  } catch {
    return null;
  }
  const payload = await AdminTokenService.verifyToken(jwt, "access");
  if (!payload?.id || !payload.email) return null;
  return payload as RequestAdmin;
}

export async function getAdminFromRequest(request: NextRequest): Promise<RequestAdmin | null> {
  const encrypted = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!encrypted) return null;

  const payload = await decryptAndVerify(encrypted);
  if (!payload?.sessionId) return payload;

  const ua = request.headers.get("user-agent") ?? "";
  const ok = await AdminAuthService.touchSession(payload.sessionId, ua);
  if (!ok) return null;

  const user = await db.adminUser.findFirst({
    where: { id: payload.id, active: true }
  });
  if (!user) return null;

  return payload;
}

export function unauthorizedResponse(message = "Admin session required.") {
  return NextResponse.json({ error: { code: "unauthorized", message } }, { status: 401 });
}

export function forbiddenResponse(message = "Insufficient permissions.") {
  return NextResponse.json({ error: { code: "forbidden", message } }, { status: 403 });
}

type AdminHandler = (request: NextRequest, admin: RequestAdmin) => Promise<Response>;

export function withAdminAuth(
  handler: AdminHandler,
  roles?: Array<"owner" | "admin" | "editor">
) {
  return async (request: NextRequest) => {
    const admin = await getAdminFromRequest(request);
    if (!admin) return unauthorizedResponse();
    if (roles && !roles.includes(admin.role as "owner" | "admin" | "editor")) {
      return forbiddenResponse();
    }
    return handler(request, admin);
  };
}
