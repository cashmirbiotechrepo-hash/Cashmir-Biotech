import { jwtVerify } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/config/auth.constants";
import { decryptTokenEdge } from "@/lib/admin/encryption-edge";

export type EdgeAdminPayload = {
  id?: string;
  email?: string;
  role?: string;
  type?: string;
  sessionId?: string;
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
    return payload as EdgeAdminPayload;
  } catch {
    return null;
  }
}
