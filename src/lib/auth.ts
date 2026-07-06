import { SignJWT, jwtVerify } from "jose";
import { compareSync } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE } from "@/config/auth.constants";
import { env } from "@/config/env.server";

function secret() {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAdminSession(email: string) {
  return new SignJWT({ email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2d")
    .sign(secret());
}

export async function verifyAdminSession(token: string) {
  const { payload } = await jwtVerify(token, secret());
  return payload;
}

export function credentialsAreValid(email: string, password: string) {
  const adminEmail = env.ADMIN_EMAIL;
  const adminHash = env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminHash) return false;
  if (email.toLowerCase() !== adminEmail.toLowerCase()) return false;
  return compareSync(password, adminHash);
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifyAdminSession(token);
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Use at the start of admin server actions so mutations cannot be invoked without a valid session. */
export async function requireAdminSession() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export const authCookieName = ADMIN_SESSION_COOKIE;
