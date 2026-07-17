import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  authorizeCron,
  cronSecretMissingResponse,
  cronUnauthorizedResponse
} from "@/lib/cron-auth";
import { processOutboxBatch } from "@/modules/shop/services/outbox.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron endpoint: process pending outbox tasks (post-payment side-effects).
 * Should be called every 1–2 minutes via external scheduler or Amplify cron.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(cronSecretMissingResponse(), { status: 503 });
  }
  if (!authorizeCron(request)) {
    return NextResponse.json(cronUnauthorizedResponse(), { status: 401 });
  }

  try {
    const result = await processOutboxBatch(10);

    logger.info(
      { event: "outbox_cron", ...result },
      `outbox cron: ${result.processed} processed, ${result.failed} failed, ${result.deadLettered} dead-lettered`
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err, event: "outbox_cron_error" }, "outbox cron failed");
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
