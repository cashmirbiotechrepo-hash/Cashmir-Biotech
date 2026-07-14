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

  let patents = -1;
  let products = -1;
  let dbHost = "";
  try {
    const raw = process.env.DATABASE_URL ?? "";
    dbHost = raw.includes("@") ? raw.split("@")[1]?.split("/")[0]?.split("?")[0] ?? "" : "";
    if (dbOk) {
      const [pCount, prodCount] = await Promise.all([db.patent.count(), db.product.count({ where: { active: true } })]);
      patents = pCount;
      products = prodCount;
    }
  } catch {
    /* keep counts as -1 */
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
          latencyMs: dbLatencyMs,
          host: dbHost || null,
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          patents,
          products
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
