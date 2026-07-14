import "server-only";
import { compareSync } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_REFRESH_COOKIE,
  ADMIN_SESSION_COOKIE,
  JWT_AUDIENCE,
  JWT_ISSUER
} from "@/config/auth.constants";
import { env } from "@/config/env.server";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/admin/encryption";
import { AdminTokenService, type AdminTokenPayload } from "@/lib/admin/tokens";
import { AdminAuthService } from "@/lib/admin/auth-service";

export const authCookieName = ADMIN_SESSION_COOKIE;

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type AdminSession = AdminTokenPayload & {
  email: string;
  role: string;
  id: string;
};

async function readAndVerifyCookie(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!encrypted) return null;

  let jwt: string;
  try {
    jwt = await decryptToken(encrypted);
  } catch {
    return null;
  }

  const payload = await AdminTokenService.verifyToken(jwt, "access");
  if (!payload?.id || !payload.email || !payload.role) return null;

  if (payload.sessionId) {
    const session = await db.adminSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.isRevoked || session.expiresAt < new Date()) return null;
  }

  return payload as AdminSession;
}

export async function verifyAdminSession(token: string) {
  try {
    const jwt = await decryptToken(token);
    return AdminTokenService.verifyToken(jwt, "access");
  } catch {
    return null;
  }
}

/** Legacy env credential check — migration/seed only */
export function credentialsAreValid(email: string, password: string) {
  const adminEmail = env.ADMIN_EMAIL;
  const adminHash = env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminHash) return false;
  const emailMatches = email.toLowerCase() === adminEmail.toLowerCase();
  return emailMatches && compareSync(password, adminHash);
}

export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const admin = await readAndVerifyCookie();
  if (!admin?.sessionId) return admin;

  // Keep lastUsedAt fresh and enforce UA binding (session hijack mitigation).
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    const ok = await AdminAuthService.touchSession(admin.sessionId, ua);
    if (!ok) return null;
  } catch {
    // headers() unavailable in rare contexts — session already validated against DB above
  }

  return admin;
}

export async function requireAdminSession() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requireAdminRole(roles: Array<"owner" | "admin" | "editor">) {
  const admin = await requireAdminSession();
  if (!roles.includes(admin.role as "owner" | "admin" | "editor")) {
    redirect("/admin/dashboard");
  }
  return admin;
}

export async function setAdminSessionCookies(accessToken: string, refreshToken?: string) {
  const encrypted = await encryptToken(accessToken);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE
  });
  if (refreshToken) {
    cookieStore.set(ADMIN_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin/auth/refresh",
      maxAge: REFRESH_COOKIE_MAX_AGE
    });
  }
}

export async function clearAdminSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete({ name: ADMIN_REFRESH_COOKIE, path: "/api/admin/auth/refresh" });
}

export { JWT_ISSUER, JWT_AUDIENCE };
