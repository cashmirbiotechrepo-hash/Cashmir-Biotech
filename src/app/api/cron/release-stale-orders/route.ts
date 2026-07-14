import { NextResponse } from "next/server";
import { releaseStalePendingOrders } from "@/modules/shop/services/order.service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sweep abandoned checkouts and free reserved stock.
 * Secure with CRON_SECRET (Authorization: Bearer <secret> or ?secret=).
 * Schedule via Vercel Cron / external scheduler every 15–30 minutes.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const urlSecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? urlSecret;
  if (provided !== expected) {
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
