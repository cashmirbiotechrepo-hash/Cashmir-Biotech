import "server-only";
import { createHash, randomUUID } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { db } from "@/lib/db";
import { env } from "@/config/env.server";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/config/auth.constants";
import { logger } from "@/lib/logger";

const ACCESS_TOKEN_EXPIRY = "2h";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

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

  static async rotateRefreshToken(
    oldToken: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const payload = await this.verifyToken(oldToken, "refresh");
      if (!payload?.sessionId) return null;

      const oldTokenHash = createHash("sha256").update(oldToken).digest("hex");
      const stored = await db.adminRefreshToken.findUnique({ where: { tokenHash: oldTokenHash } });
      if (!stored) return null;

      if (stored.revoked) {
        logger.warn({ event: "refresh_token_reuse", sessionId: stored.sessionId }, "token reuse detected");
        await db.adminSession.updateMany({
          where: { id: stored.sessionId },
          data: { isRevoked: true }
        });
        await db.adminRefreshToken.updateMany({
          where: { sessionId: stored.sessionId },
          data: { revoked: true }
        });
        return null;
      }

      await db.adminRefreshToken.update({
        where: { id: stored.id },
        data: { revoked: true }
      });

      const session = await db.adminSession.findUnique({ where: { id: payload.sessionId } });
      if (!session || session.isRevoked || session.expiresAt < new Date()) return null;

      const user = await db.adminUser.findFirst({
        where: { id: session.userId, active: true }
      });
      if (!user) return null;

      const accessToken = await this.createAccessToken({
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionId: session.id
      });
      const { token: refreshToken } = await this.createRefreshToken(session.id);
      return { accessToken, refreshToken };
    } catch (err) {
      logger.error({ err, event: "refresh_rotate_failed" }, "refresh rotation failed");
      return null;
    }
  }
}
