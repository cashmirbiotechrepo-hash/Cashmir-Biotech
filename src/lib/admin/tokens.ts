import "server-only";
import { createHash, randomUUID } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { db } from "@/lib/db";
import { env } from "@/config/env.server";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/config/auth.constants";
import { logger } from "@/lib/logger";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Concurrent refreshes (two tabs, mount + visibilitychange) can present the same
 * refresh token. If the token was rotated within this window, treat it as a
 * benign race instead of a stolen-token replay.
 */
const ROTATION_GRACE_MS = 10000;

function jwtSecret() {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export type AdminTokenPayload = JWTPayload & {
  id: string;
  email: string;
  role: string;
  name?: string;
  sessionId?: string;
  type?: "access" | "refresh";
};

export type RotateRefreshResult =
  | { status: "rotated"; accessToken: string; refreshToken: string }
  /** Another concurrent request already rotated this token — session is still healthy. */
  | { status: "raced" }
  | { status: "invalid" }
  /** Transient infra failure — caller must NOT clear cookies / force logout. */
  | { status: "unavailable" };

export class AdminTokenService {
  static async createAccessToken(payload: Omit<AdminTokenPayload, "type">): Promise<string> {
    return new SignJWT({ ...payload, type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(jwtSecret());
  }

  static async createRefreshToken(sessionId: string): Promise<{ token: string; jti: string }> {
    const jti = randomUUID();
    const jwt = await new SignJWT({ sessionId, type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setJti(jti)
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(jwtSecret());

    const tokenHash = createHash("sha256").update(jwt).digest("hex");
    await db.adminRefreshToken.create({
      data: {
        sessionId,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
      }
    });
    return { token: jwt, jti };
  }

  static async verifyToken(
    token: string,
    expectedType?: "access" | "refresh"
  ): Promise<AdminTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, jwtSecret(), {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
      const typed = payload as AdminTokenPayload;
      if (expectedType && typed.type !== expectedType) return null;
      return typed;
    } catch {
      return null;
    }
  }

  static async rotateRefreshToken(oldToken: string): Promise<RotateRefreshResult> {
    // JWT verification errors are invalid tokens; DB failures must not force logout (audit MED-01).
    const payload = await this.verifyToken(oldToken, "refresh");
    if (!payload?.sessionId) return { status: "invalid" };

    try {
      const oldTokenHash = createHash("sha256").update(oldToken).digest("hex");
      const stored = await db.adminRefreshToken.findUnique({ where: { tokenHash: oldTokenHash } });
      if (!stored) return { status: "invalid" };

      if (!stored.revoked) {
        // Atomic claim — only one concurrent request wins the rotation.
        const claimed = await db.adminRefreshToken.updateMany({
          where: { id: stored.id, revoked: false },
          data: { revoked: true }
        });
        if (claimed.count === 0) {
          return this.classifyRevokedToken(stored.sessionId);
        }
      } else {
        return this.classifyRevokedToken(stored.sessionId);
      }

      const session = await db.adminSession.findUnique({ where: { id: payload.sessionId } });
      if (!session || session.isRevoked || session.expiresAt < new Date()) return { status: "invalid" };

      // Hard-cap sliding expiry at 30 days from session creation
      const maxAbsoluteExpiry = new Date(session.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const slidingExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const newExpiresAt = slidingExpiry > maxAbsoluteExpiry ? maxAbsoluteExpiry : slidingExpiry;
      if (newExpiresAt <= new Date()) return { status: "invalid" };

      await db.adminSession.update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(),
          expiresAt: newExpiresAt
        }
      });

      const user = await db.adminUser.findFirst({
        where: { id: session.userId, active: true }
      });
      if (!user) return { status: "invalid" };

      const accessToken = await this.createAccessToken({
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionId: session.id
      });
      const { token: refreshToken } = await this.createRefreshToken(session.id);
      return { status: "rotated", accessToken, refreshToken };
    } catch (err) {
      logger.error({ err, event: "refresh_rotate_unavailable" }, "refresh rotation unavailable");
      return { status: "unavailable" };
    }
  }

  /**
   * A revoked token was presented. If it was rotated moments ago this is almost
   * certainly a concurrent-refresh race (second tab, mount + visibilitychange),
   * not a replay attack — leave the session alone. Outside the grace window,
   * treat it as reuse and revoke the whole session.
   */
  private static async classifyRevokedToken(sessionId: string): Promise<RotateRefreshResult> {
    const newest = await db.adminRefreshToken.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });
    if (newest && Date.now() - newest.createdAt.getTime() < ROTATION_GRACE_MS) {
      return { status: "raced" };
    }

    logger.warn({ event: "refresh_token_reuse", sessionId }, "token reuse detected");
    await db.adminSession.updateMany({
      where: { id: sessionId },
      data: { isRevoked: true }
    });
    await db.adminRefreshToken.updateMany({
      where: { sessionId },
      data: { revoked: true }
    });
    return { status: "invalid" };
  }
}
