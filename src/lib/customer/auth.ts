import "server-only";
import type { Prisma } from "@prisma/client";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  CUSTOMER_JWT_AUDIENCE,
  CUSTOMER_REFRESH_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  JWT_ISSUER
} from "@/config/auth.constants";
import { env } from "@/config/env.server";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/admin/encryption";
import { logger } from "@/lib/logger";
import { sendOtpMail } from "@/lib/admin/mail";

const SESSION_DAYS = 90;
/** Long-lived access so customers stay signed in across visits; revoke still clears DB session. */
const ACCESS_TOKEN_EXPIRY = "15m";
const ACCESS_COOKIE_MAX_AGE = 15 * 60; // 15 minutes in seconds

const REFRESH_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 days in seconds
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function jwtSecret() {
  return new TextEncoder().encode(env.CUSTOMER_JWT_SECRET ?? env.JWT_SECRET);
}

function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export type CustomerSessionPayload = {
  id: string;
  email: string;
  name?: string | null;
  sessionId: string;
  emailVerified: boolean;
};

export async function linkGuestOrdersToCustomer(customerId: string, email: string) {
  const normalized = email.toLowerCase().trim();
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  const phone = customer?.phone?.trim();

  // BIZ-18 FIX: Only link guest orders where the phone number matches the verified customer account
  // (or where the guest order had no phone recorded), preventing email-only OTP intercepts from
  // exposing historical order history and invoices with mismatched phone numbers.
  const whereClause: Prisma.OrderWhereInput = {
    customerId: null,
    customerEmail: { equals: normalized, mode: "insensitive" }
  };

  if (phone) {
    whereClause.OR = [{ customerPhone: "" }, { customerPhone: phone }];
  } else {
    whereClause.customerPhone = "";
  }

  const result = await db.order.updateMany({
    where: whereClause,
    data: { customerId }
  });
  return { linkedCount: result.count };
}

/** Find-or-create customer after checkout (no password; unverified until OTP). */
export async function ensureCustomerFromCheckout(input: {
  email: string;
  name?: string | null;
  phone?: string | null;
}) {
  const email = input.email.toLowerCase().trim();
  if (!email) return null;

  const existing = await db.customer.findUnique({ where: { email } });
  if (existing) {
    await db.customer.update({
      where: { id: existing.id },
      data: {
        ...(input.name && !existing.name ? { name: input.name } : {}),
        ...(input.phone && !existing.phone ? { phone: input.phone } : {})
      }
    });
    return existing.id;
  }

  const created = await db.customer.create({
    data: {
      email,
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null
    }
  });
  return created.id;
}

export async function attachOrderToCustomer(orderId: string, customerId: string) {
  await db.order.update({ where: { id: orderId }, data: { customerId } });
}

export async function requestPortalOtp(emailRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = emailRaw.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const isLive = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (isLive && !smtpReady) {
    logger.error({ event: "portal_otp_smtp_missing" }, "SMTP not configured — portal OTP unavailable");
    return { ok: false, error: "Login email could not be sent. Please try again later or contact support." };
  }
  if (process.env.VERCEL_ENV === "preview" && !smtpReady) {
    logger.error({ event: "portal_otp_smtp_missing_preview" }, "SMTP missing on preview");
    return { ok: false, error: "Login email could not be sent. Please try again later." };
  }

  // Uniform cooldown for every email (known or unknown) — closes OTP enumeration (H5).
  const recentAny = await db.customerOtp.findFirst({
    where: { email, purpose: "login" },
    orderBy: { createdAt: "desc" }
  });
  if (recentAny && recentAny.createdAt.getTime() > Date.now() - OTP_COOLDOWN_MS) {
    return { ok: true };
  }

  let customer = await db.customer.findUnique({ where: { email } });
  const guestOrder = await db.order.findFirst({
    where: { customerEmail: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, customerPhone: true }
  });

  // Always create a cooldown marker OTP row for unknown emails (never sent).
  if (!customer && !guestOrder) {
    await db.customerOtp.create({
      data: {
        email,
        codeHash: hashOtp(String(randomInt(100000, 1000000))),
        purpose: "login",
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        usedAt: new Date()
      }
    });
    return { ok: true };
  }

  if (!customer) {
    customer = await db.customer.create({
      data: {
        email,
        name: guestOrder?.customerName ?? null,
        phone: guestOrder?.customerPhone || null
      }
    });
  }

  const code = String(randomInt(100000, 1000000));
  await db.customerOtp.create({
    data: {
      customerId: customer.id,
      email,
      codeHash: hashOtp(code),
      purpose: "login",
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS)
    }
  });

  if (smtpReady) {
    const sent = await sendOtpMail({
      to: email,
      kind: "portal_login",
      code
    });
    if (!sent) {
      logger.error({ event: "portal_otp_send_failed", email }, "portal OTP SMTP send returned false");
      return {
        ok: false,
        error: "Login email could not be sent. Please try again later or contact support."
      };
    }
  } else {
    // Local development only.
    logger.info({ event: "portal_otp_dev", email, code }, `[DEV] Portal OTP for ${email}`);
  }

  return { ok: true };
}

export async function verifyPortalOtp(
  emailRaw: string,
  code: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ ok: true; customer: CustomerSessionPayload } | { ok: false; error: string }> {
  const email = emailRaw.toLowerCase().trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code." };

  const customer = await db.customer.findUnique({ where: { email } });
  if (!customer || !customer.active) {
    return { ok: false, error: "Invalid or expired code." };
  }

  // HIGH-04 FIX: Check all active (unused, unexpired, attempts < MAX) OTP codes for this email and purpose,
  // rather than strictly the newest row. This prevents an attacker from causing DoS by requesting a new code
  // every 60s while the victim is typing their valid code.
  const activeOtps = await db.customerOtp.findMany({
    where: {
      email,
      purpose: "login",
      usedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_OTP_ATTEMPTS }
    },
    orderBy: { createdAt: "desc" }
  });
  if (activeOtps.length === 0) {
    return { ok: false, error: "Invalid or expired code." };
  }

  let matchedOtp: (typeof activeOtps)[number] | null = null;
  const inputHashBuf = Buffer.from(hashOtp(code));

  for (const candidate of activeOtps) {
    const candBuf = Buffer.from(candidate.codeHash);
    if (candBuf.length === inputHashBuf.length && timingSafeEqual(candBuf, inputHashBuf)) {
      matchedOtp = candidate;
    }
  }

  if (!matchedOtp) {
    await db.customerOtp.update({
      where: { id: activeOtps[0]!.id },
      data: { attempts: { increment: 1 } }
    });
    return { ok: false, error: "Invalid or expired code." };
  }

  // Mark all unused login OTPs for this email as used so none can be replayed
  await db.customerOtp.updateMany({
    where: { email, purpose: "login", usedAt: null },
    data: { usedAt: new Date() }
  });

  const firstVerify = !customer.emailVerifiedAt;
  if (firstVerify) {
    await db.customer.update({
      where: { id: customer.id },
      data: { emailVerifiedAt: new Date() }
    });
  }

  const { linkedCount } = await linkGuestOrdersToCustomer(customer.id, email);

  const session = await createCustomerSession(customer.id, meta);
  const access = await mintCustomerAccessToken({
    id: customer.id,
    email: customer.email,
    name: customer.name,
    sessionId: session.id,
    emailVerified: true
  });
  const refresh = await mintCustomerRefreshToken(session.id);
  await setCustomerSessionCookies(access, refresh);

  logger.info(
    { event: "portal_login", customerId: customer.id, linkedCount, firstVerify },
    "customer portal login"
  );

  return {
    ok: true,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      sessionId: session.id,
      emailVerified: true
    }
  };
}

async function createCustomerSession(
  customerId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  return db.customerSession.create({
    data: {
      id: randomUUID(),
      customerId,
      ipAddress: meta?.ip ?? null,
      userAgent: (meta?.userAgent ?? "").slice(0, 500) || null,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    }
  });
}

async function mintCustomerAccessToken(payload: CustomerSessionPayload) {
  return new SignJWT({
    id: payload.id,
    email: payload.email,
    name: payload.name ?? undefined,
    sessionId: payload.sessionId,
    emailVerified: payload.emailVerified,
    type: "customer_access"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(CUSTOMER_JWT_AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(jwtSecret());
}

async function mintCustomerRefreshToken(sessionId: string): Promise<string> {
  const jti = randomUUID();
  const jwt = await new SignJWT({ sessionId, type: "customer_refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(CUSTOMER_JWT_AUDIENCE)
    .setExpirationTime("90d")
    .sign(jwtSecret());

  const tokenHash = createHash("sha256").update(jwt).digest("hex");
  await db.customerRefreshToken.create({
    data: {
      sessionId,
      tokenHash,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    }
  });
  return jwt;
}

export async function setCustomerSessionCookies(accessToken: string, refreshToken?: string) {
  const encrypted = await encryptToken(accessToken);
  const jar = await cookies();
  jar.set(CUSTOMER_SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE
  });
  if (refreshToken) {
    const encryptedRefresh = await encryptToken(refreshToken);
    jar.set(CUSTOMER_REFRESH_COOKIE, encryptedRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      // __Host- cookies require Path=/ — a scoped path is rejected by browsers.
      path: "/",
      maxAge: REFRESH_COOKIE_MAX_AGE
    });
  }
}

export async function clearCustomerSessionCookies() {
  const jar = await cookies();
  jar.delete(CUSTOMER_SESSION_COOKIE);
  jar.delete(CUSTOMER_REFRESH_COOKIE);
  jar.delete({ name: CUSTOMER_REFRESH_COOKIE, path: "/api/portal/auth/refresh" });
}

export type CustomerRotateRefreshResult =
  | { status: "rotated"; accessToken: string; refreshToken: string }
  | { status: "raced" }
  | { status: "invalid" };

/** Rotates customer refresh token — returns discriminated status (rotated, raced, or invalid). */
export async function rotateCustomerRefresh(encryptedRefreshCookie: string): Promise<CustomerRotateRefreshResult> {
  let jwt: string;
  try { jwt = await decryptToken(encryptedRefreshCookie); } catch { return { status: "invalid" }; }

  try {
    const { payload } = await jwtVerify(jwt, jwtSecret(), {
      issuer: JWT_ISSUER,
      audience: CUSTOMER_JWT_AUDIENCE
    });
    if (payload.type !== "customer_refresh" || typeof payload.sessionId !== "string") return { status: "invalid" };

    // CRIT-02 FIX: Lookup refresh token hash in db for reuse detection and single-use rotation.
    const tokenHash = createHash("sha256").update(jwt).digest("hex");
    const stored = await db.customerRefreshToken.findUnique({ where: { tokenHash } });
    if (!stored) return { status: "invalid" };

    if (stored.revoked) {
      const newest = await db.customerRefreshToken.findFirst({
        where: { sessionId: stored.sessionId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      });
      if (newest && Date.now() - newest.createdAt.getTime() < 10000) {
        // Concurrent refresh race inside 10s window — do not false-trigger full session revocation
        return { status: "raced" };
      }

      // Token reuse detected outside grace window! Revoke the entire customer session immediately.
      logger.warn({ event: "customer_refresh_token_reuse", sessionId: stored.sessionId }, "customer refresh token reuse detected");
      await db.$transaction(async (tx) => {
        await tx.customerSession.updateMany({
          where: { id: stored.sessionId },
          data: { isRevoked: true }
        });
        await tx.customerRefreshToken.updateMany({
          where: { sessionId: stored.sessionId },
          data: { revoked: true }
        });
      });
      return { status: "invalid" };
    }

    // Atomic claim — only one concurrent request wins rotation.
    const claimed = await db.customerRefreshToken.updateMany({
      where: { id: stored.id, revoked: false },
      data: { revoked: true }
    });
    if (claimed.count === 0) return { status: "raced" };

    const session = await db.customerSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.isRevoked || session.expiresAt < new Date()) return { status: "invalid" };

    // Sliding expiry — stay logged in while the account is used, hard-capped at SESSION_DAYS from creation
    const maxAbsoluteExpiry = new Date(session.createdAt.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const slidingExpiry = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const newExpiresAt = slidingExpiry > maxAbsoluteExpiry ? maxAbsoluteExpiry : slidingExpiry;
    if (newExpiresAt <= new Date()) return { status: "invalid" };

    await db.customerSession
      .update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(),
          expiresAt: newExpiresAt
        }
      })
      .catch(() => undefined);

    const customer = await db.customer.findUnique({ where: { id: session.customerId } });
    if (!customer || !customer.active) return { status: "invalid" };

    const accessToken = await mintCustomerAccessToken({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      sessionId: session.id,
      emailVerified: Boolean(customer.emailVerifiedAt)
    });
    const refreshToken = await mintCustomerRefreshToken(session.id);
    return { status: "rotated", accessToken, refreshToken };
  } catch {
    return { status: "invalid" };
  }
}

export async function getCurrentCustomer(): Promise<CustomerSessionPayload | null> {
  const jar = await cookies();
  const encrypted = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!encrypted) return null;

  let jwt: string;
  try {
    jwt = await decryptToken(encrypted);
  } catch {
    return null;
  }

  try {
    const { payload } = await jwtVerify(jwt, jwtSecret(), {
      issuer: JWT_ISSUER,
      audience: CUSTOMER_JWT_AUDIENCE
    });
    if (payload.type !== "customer_access" || typeof payload.id !== "string") return null;
    if (typeof payload.sessionId !== "string" || typeof payload.email !== "string") return null;

    const session = await db.customerSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.isRevoked || session.expiresAt < new Date()) return null;

    const customer = await db.customer.findUnique({
      where: { id: payload.id },
      select: { active: true, email: true, name: true, emailVerifiedAt: true }
    });
    if (!customer?.active) return null;

    await db.customerSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    }).catch(() => undefined);

    return {
      id: payload.id,
      email: customer.email,
      name: customer.name,
      sessionId: payload.sessionId,
      emailVerified: Boolean(customer.emailVerifiedAt)
    };
  } catch {
    return null;
  }
}

export async function requireCustomerSession() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/portal/login");
  return customer;
}

export async function logoutCustomer() {
  const customer = await getCurrentCustomer();
  if (customer?.sessionId) {
    await db.customerSession.update({
      where: { id: customer.sessionId },
      data: { isRevoked: true }
    }).catch(() => undefined);
    await db.customerRefreshToken.updateMany({
      where: { sessionId: customer.sessionId, revoked: false },
      data: { revoked: true }
    }).catch(() => undefined);
    const { markSessionRevokedEdge } = await import("@/lib/session-revoke-edge");
    await markSessionRevokedEdge(customer.sessionId).catch(() => undefined);
  }
  await clearCustomerSessionCookies();
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined
  };
}
