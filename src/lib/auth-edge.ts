import { jwtVerify } from "jose";

/**
 * Edge-safe JWT check for middleware. Does not import bcrypt or full env schema (avoids DATABASE_URL in Edge path).
 */
export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  const key = process.env.JWT_SECRET;
  if (!key || key.length < 32) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(key));
    return payload.role === "admin";
  } catch {
    return false;
  }
}
