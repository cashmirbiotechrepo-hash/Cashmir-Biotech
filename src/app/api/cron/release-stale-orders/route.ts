import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { releaseStalePendingOrders } from "@/modules/shop/services/order.service";
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
  if (process.env.NODE_ENV === "production") {
    return Boolean(bearer && safeCompareSecrets(bearer, expected));
  }
  const urlSecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? urlSecret;
  return Boolean(provided && safeCompareSecrets(provided, expected));
}

/**
 * Sweep abandoned checkouts and free reserved stock.
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
    const result = await releaseStalePendingOrders(45);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err, event: "cron_release_stale_orders_failed" }, "stale order sweep failed");
    return NextResponse.json({ ok: false, error: "Sweep failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
