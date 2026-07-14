import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeCompareSecrets(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorizeCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  // Production: Bearer only (no query-string secret leak via logs/Referer).
  if (process.env.NODE_ENV === "production") {
    return Boolean(bearer && safeCompareSecrets(bearer, expected));
  }
  const urlSecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? urlSecret;
  return Boolean(provided && safeCompareSecrets(provided, expected));
}

/**
 * Stale session and OTP cleanup cron.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [adminSessions, adminTokens, customerSessions, otps] = await Promise.all([
      db.adminSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { AND: [{ isRevoked: true }, { lastUsedAt: { lt: sevenDaysAgo } }] }
          ]
        }
      }),
      db.adminRefreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { AND: [{ revoked: true }, { createdAt: { lt: sevenDaysAgo } }] }
          ]
        }
      }),
      db.customerSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { AND: [{ isRevoked: true }, { createdAt: { lt: sevenDaysAgo } }] }
          ]
        }
      }),
      db.customerOtp.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { AND: [{ usedAt: { not: null } }, { createdAt: { lt: oneDayAgo } }] }
          ]
        }
      })
    ]);

    logger.info(
      {
        event: "cron_cleanup_sessions_completed",
        deleted: {
          adminSessions: adminSessions.count,
          adminTokens: adminTokens.count,
          customerSessions: customerSessions.count,
          otps: otps.count
        }
      },
      "Cleaned up stale sessions and OTPs."
    );

    return NextResponse.json({
      ok: true,
      cleaned: {
        adminSessions: adminSessions.count,
        adminTokens: adminTokens.count,
        customerSessions: customerSessions.count,
        otps: otps.count
      }
    });
  } catch (err) {
    logger.error({ err, event: "cron_cleanup_sessions_failed" }, "stale session cleanup failed");
    return NextResponse.json({ ok: false, error: "Cleanup failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
