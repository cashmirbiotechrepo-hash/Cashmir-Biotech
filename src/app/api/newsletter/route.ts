import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const subscribeSchema = z.object({
  email: z.string().trim().email().max(320)
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid email address" },
      { status: 422 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  try {
    // Upsert keeps the endpoint idempotent and avoids leaking whether an email is already subscribed.
    await db.subscriber.upsert({
      where: { email },
      update: { status: "subscribed", unsubscribedAt: null },
      create: { email, source: "homepage" }
    });
  } catch (error) {
    logger.error({ event: "newsletter_subscribe_failed", err: error }, "failed to store subscriber");
    return NextResponse.json(
      { ok: false, error: "Could not save your subscription. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
