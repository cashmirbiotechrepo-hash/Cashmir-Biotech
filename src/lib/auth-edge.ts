import { jwtVerify } from "jose";
import { CUSTOMER_JWT_AUDIENCE, JWT_AUDIENCE, JWT_ISSUER } from "@/config/auth.constants";
import { decryptTokenEdge } from "@/lib/admin/encryption-edge";
import { isSessionRevokedEdge } from "@/lib/session-revoke-edge";

export type EdgeAdminPayload = {
  id?: string;
  email?: string;
  role?: string;
  type?: string;
  sessionId?: string;
};

export type EdgeCustomerPayload = {
  id?: string;
  email?: string;
  name?: string;
  sessionId?: string;
  type?: string;
};

/**
 * Edge-safe admin session check for middleware.
 * Decrypts JWE cookie → verifies HS256 JWT (access token only).
 */
export async function verifyAdminSessionToken(encrypted: string): Promise<EdgeAdminPayload | null> {
  const key = process.env.JWT_SECRET;
  if (!key || key.length < 32) return null;

  const jwt = await decryptTokenEdge(encrypted);
  if (!jwt) return null;

  try {
    const { payload } = await jwtVerify(jwt, new TextEncoder().encode(key), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    if (payload.type !== "access") return null;
    if (!payload.id || !payload.role) return null;
    if (typeof payload.sessionId === "string" && (await isSessionRevokedEdge(payload.sessionId))) {
      return null;
    }
    return payload as EdgeAdminPayload;
  } catch {
    return null;
  }
}

/**
 * Edge-safe customer portal session check for middleware. (HIGH-04)
 * Decrypts JWE cookie → verifies HS256 JWT (customer access token only).
 */
export async function verifyCustomerSessionToken(encrypted: string): Promise<EdgeCustomerPayload | null> {
  // Prefer dedicated portal secret when set (falls back to JWT_SECRET for migration).
  const key = process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET;
  if (!key || key.length < 32) return null;

  const jwt = await decryptTokenEdge(encrypted);
  if (!jwt) return null;

  try {
    const { payload } = await jwtVerify(jwt, new TextEncoder().encode(key), {
      issuer: JWT_ISSUER,
      audience: CUSTOMER_JWT_AUDIENCE
    });
    if (payload.type !== "customer_access") return null;
    if (!payload.id || !payload.sessionId || !payload.email) return null;
    if (await isSessionRevokedEdge(String(payload.sessionId))) return null;
    return payload as EdgeCustomerPayload;
  } catch {
    return null;
  }
}
