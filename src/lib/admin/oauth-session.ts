import "server-only";
import { randomUUID } from "crypto";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { JWT_ISSUER, JWT_AUDIENCE } from "@/config/auth.constants";

const SESSION_DAYS = 30; // Hardcoded to 30 to match admin auth service
const ACCESS_TOKEN_EXPIRY = "15m";

function adminJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Admin JWT secret not configured");
  return new TextEncoder().encode(secret);
}

function requestMeta(request: Request) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    undefined;
  const userAgent = request.headers.get("user-agent") ?? "";
  return { ip, userAgent };
}

/**
 * Creates an AdminSession row and mints access + refresh JWT pair.
 * Used by Admin OAuth callbacks.
 */
export async function createAdminSessionFromOAuth(
  adminId: string,
  request: Request
): Promise<{ accessToken: string; refreshToken: string }> {
  const meta = requestMeta(request);

  const admin = await db.adminUser.findUniqueOrThrow({
    where: { id: adminId },
    select: { id: true, email: true, name: true, role: true }
  });

  const session = await db.adminSession.create({
    data: {
      id: randomUUID(),
      userId: adminId,
      ipAddress: meta.ip ?? null,
      userAgent: (meta.userAgent ?? "").slice(0, 500) || null,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    }
  });

  const accessToken = await new SignJWT({
    id: admin.id,
    email: admin.email,
    name: admin.name ?? undefined,
    role: admin.role,
    sessionId: session.id,
    type: "access"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(adminJwtSecret());

  const jti = randomUUID();
  const refreshToken = await new SignJWT({ sessionId: session.id, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(adminJwtSecret());

  const tokenHash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(refreshToken))
  ).toString("hex");

  await db.adminRefreshToken.create({
    data: {
      sessionId: session.id,
      tokenHash,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    }
  });

  logger.info(
    { event: "oauth_admin_session_created", adminId, sessionId: session.id },
    "Admin session created via OAuth"
  );

  return { accessToken, refreshToken };
}
