import "server-only";
import { randomUUID } from "crypto";
import type { AdminRole, AdminUser } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/modules/admin/services/audit.service";
import { AdminPasswordService } from "@/lib/admin/password";
import { AdminTokenService } from "@/lib/admin/tokens";

const SESSION_EXPIRY_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export class AccountLockedError extends AdminAuthError {
  constructor(public readonly lockedUntil: Date) {
    const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    super(
      `Account temporarily locked. Try again in ${mins} minute(s).`,
      "ACCOUNT_LOCKED",
      423
    );
  }
}

export type SessionResult = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: Pick<AdminUser, "id" | "email" | "name" | "role">;
};

export type LoginResult =
  | SessionResult
  | { requireTwoFactor: true; email: string };

export class AdminAuthService {
  static async findByEmail(email: string) {
    return db.adminUser.findFirst({
      where: { email: email.toLowerCase().trim(), active: true }
    });
  }

  static async login(
    email: string,
    password: string,
    ip: string,
    userAgent: string,
    twoFactorCode?: string
  ): Promise<LoginResult> {
    const normalized = email.toLowerCase().trim();
    const user = await this.findByEmail(normalized);

    if (!user) {
      AdminPasswordService.dummyVerify();
      throw new AdminAuthError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AccountLockedError(user.lockedUntil);
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await db.adminUser.update({
        where: { id: user.id },
        data: { lockedUntil: null, failedLoginAttempts: 0 }
      });
    }

    const valid = AdminPasswordService.verify(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await db.adminUser.update({
          where: { id: user.id },
          data: { failedLoginAttempts: attempts, lockedUntil }
        });
        await writeAuditLog({
          userEmail: user.email,
          action: "account_locked",
          entityType: "admin_user",
          entityId: user.id,
          diff: { reason: "too_many_failed_attempts", ip }
        });
        throw new AccountLockedError(lockedUntil);
      }
      await db.adminUser.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts }
      });
      throw new AdminAuthError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    // Upgrade legacy bcrypt (no pepper) to peppered hash
    if (AdminPasswordService.needsPepperUpgrade(password, user.passwordHash)) {
      await db.adminUser.update({
        where: { id: user.id },
        data: { passwordHash: AdminPasswordService.hash(password) }
      });
    }

    await db.adminUser.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }
    });

    if (user.isTwoFactorEnabled) {
      if (!twoFactorCode) {
        const { generateAdminTwoFactorCode } = await import("@/lib/admin/two-factor");
        await generateAdminTwoFactorCode(normalized);
        return { requireTwoFactor: true, email: normalized };
      }
      const { verifyAdminTwoFactorCode } = await import("@/lib/admin/two-factor");
      const ok = await verifyAdminTwoFactorCode(normalized, twoFactorCode);
      if (!ok) {
        throw new AdminAuthError("Invalid or expired verification code.", "INVALID_2FA", 400);
      }
    }

    return this.createSession(user, ip, userAgent);
  }

  static async createSession(
    user: Pick<AdminUser, "id" | "email" | "name" | "role">,
    ip: string,
    userAgent: string
  ): Promise<SessionResult> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const ua = userAgent.slice(0, 500);

    try {
      await db.adminSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          ipAddress: ip,
          userAgent: ua,
          expiresAt
        }
      });

      const accessToken = await AdminTokenService.createAccessToken({
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionId
      });
      const { token: refreshToken } = await AdminTokenService.createRefreshToken(sessionId);

      await writeAuditLog({
        userEmail: user.email,
        action: "login",
        entityType: "admin_session",
        entityId: sessionId,
        diff: { ip, userAgent: ua.slice(0, 100) }
      });

      return {
        accessToken,
        refreshToken,
        sessionId,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      };
    } catch (err) {
      logger.error({ err, event: "admin_session_create_failed" }, "session create failed");
      await db.adminSession.delete({ where: { id: sessionId } }).catch(() => undefined);
      throw err;
    }
  }

  static async logout(sessionId: string, userEmail?: string) {
    if (!sessionId) return;
    await db.adminSession.updateMany({
      where: { id: sessionId, isRevoked: false },
      data: { isRevoked: true, lastUsedAt: new Date() }
    });
    await db.adminRefreshToken.updateMany({
      where: { sessionId, revoked: false },
      data: { revoked: true }
    });
    const { markSessionRevokedEdge } = await import("@/lib/session-revoke-edge");
    await markSessionRevokedEdge(sessionId).catch(() => undefined);
    if (userEmail) {
      await writeAuditLog({
        userEmail,
        action: "logout",
        entityType: "admin_session",
        entityId: sessionId
      });
    }
  }

  static async touchSession(sessionId: string, userAgent: string): Promise<boolean> {
    const session = await db.adminSession.findUnique({ where: { id: sessionId } });
    if (!session || session.isRevoked || session.expiresAt < new Date()) return false;

    const ua = userAgent.slice(0, 500);
    if (session.userAgent && session.userAgent !== ua) {
      logger.warn({ event: "admin_session_ua_mismatch", sessionId }, "session UA mismatch");
      await this.logout(sessionId);
      return false;
    }

    await db.adminSession.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() }
    });
    return true;
  }

  static async revokeAllSessions(userId: string, exceptSessionId?: string) {
    const sessions = await db.adminSession.findMany({
      where: { userId, isRevoked: false }
    });
    for (const s of sessions) {
      if (exceptSessionId && s.id === exceptSessionId) continue;
      await this.logout(s.id);
    }
  }

  static hasRole(role: AdminRole, allowed: AdminRole[]): boolean {
    return allowed.includes(role);
  }
}
