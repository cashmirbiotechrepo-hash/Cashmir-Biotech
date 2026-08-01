import { NextResponse } from "next/server";
import { z } from "zod";
import { requestMeta, requestPortalOtp } from "@/lib/customer/auth";
import { requireJsonContent } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(254)
});

export async function POST(request: Request) {
  const invalidType = requireJsonContent(request);
  if (invalidType) return invalidType;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Check if customer exists and has a password
  const customer = await db.customer.findUnique({
    where: { email },
    select: { id: true, active: true, passwordHash: true }
  });

  // Always return success to prevent email enumeration, but only send OTP if valid
  if (!customer) {
    logger.info({ event: "password_reset_request_unknown_email", email }, "Password reset requested for unknown email");
    return NextResponse.json({ ok: true });
  }

  if (!customer.active) {
    logger.warn({ event: "password_reset_request_inactive_account", email }, "Password reset requested for inactive account");
    return NextResponse.json({ ok: true });
  }

  await requestMeta();
  
  // Use the new purpose parameter
  const result = await requestPortalOtp(email, "password_reset");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
