import { NextResponse } from "next/server";
import { ensureDatabaseUrl } from "@/lib/database-url";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public health check — minimal payload for load balancers.
 * Detailed probe available with Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  ensureDatabaseUrl();
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;
  let dbError = "";

  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1 as health`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    dbOk = false;
    dbError = err instanceof Error ? err.message.slice(0, 200) : "db_error";
  }

  const status = dbOk ? "ok" : "degraded";
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const detailed =
    Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;

  if (!detailed) {
    return NextResponse.json(
      {
        status,
        // Safe hint so Amplify env mistakes are obvious without secrets
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasDbHostParts: Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME)
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
          hasDbHostParts: Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME),
          error: dbOk ? null : dbError || null,
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
