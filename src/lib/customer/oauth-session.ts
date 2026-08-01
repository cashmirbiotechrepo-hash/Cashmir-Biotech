import "server-only";
import { randomUUID } from "crypto";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  CUSTOMER_JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_AUDIENCE
} from "@/config/auth.constants";

// Re-export the same session constants used in the existing auth module
const SESSION_DAYS = 90;
const ACCESS_TOKEN_EXPIRY = "15m";

function customerJwtSecret(): Uint8Array {
  const secret = process.env.CUSTOMER_JWT_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error("Customer JWT secret not configured");
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

// ── Customer ─────────────────────────────────────────────────────────────────

/**
 * Creates a CustomerSession row and mints access + refresh JWT pair.
 * Used by OAuth callbacks so they don't need to reach into the OTP auth module.
 */
export async function createCustomerSessionFromOAuth(
  customerId: string,
  request: Request
): Promise<{ accessToken: string; refreshToken: string }> {
  const meta = requestMeta(request);

  const customer = await db.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });

  const session = await db.customerSession.create({
    data: {
      id: randomUUID(),
      customerId,
      ipAddress: meta.ip ?? null,
      userAgent: (meta.userAgent ?? "").slice(0, 500) || null,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    }
  });

  const accessToken = await new SignJWT({
    id: customer.id,
    email: customer.email,
    name: customer.name ?? undefined,
    sessionId: session.id,
    emailVerified: !!customer.emailVerifiedAt,
    type: "customer_access"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(CUSTOMER_JWT_AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(customerJwtSecret());

  // Mint refresh token
  const jti = randomUUID();
  const refreshToken = await new SignJWT({ sessionId: session.id, type: "customer_refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(CUSTOMER_JWT_AUDIENCE)
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(customerJwtSecret());

  const tokenHash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(refreshToken))
  ).toString("hex");

  await db.customerRefreshToken.create({
    data: {
      sessionId: session.id,
      tokenHash,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    }
  });

  logger.info(
    { event: "oauth_customer_session_created", customerId, sessionId: session.id },
    "Customer session created via OAuth"
  );

  return { accessToken, refreshToken };
}
