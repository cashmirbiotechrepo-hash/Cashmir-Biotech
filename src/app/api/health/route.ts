import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public health check — minimal payload for load balancers.
 * Detailed probe available with Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1 as health`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "ok" : "degraded";
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const detailed =
    Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;

  if (!detailed) {
    return NextResponse.json(
      { status },
      {
        status: dbOk ? 200 : 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Health-Check": status
        }
      }
    );
  }

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? "1.0.0",
      checks: {
        database: {
          status: dbOk ? "ok" : "error",
          latencyMs: dbLatencyMs
        }
      },
      durationMs: Date.now() - start
    },
    {
      status: dbOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Health-Check": status
      }
    }
  );
}
