import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyPortalOtp } from "@/lib/customer/auth";

export const runtime = "nodejs";

const confirmSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8, "Password must be at least 8 characters")
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = confirmSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ ok: false, error: "Invalid request data." }, { status: 400 });
    }

    const { email, code, newPassword } = result.data;

    // Verify OTP with purpose "password_reset", but do not mint a session (Issue II.4)
    const verifyResult = await verifyPortalOtp(email, code, undefined, "password_reset", false);
    
    if (!verifyResult.ok) {
      return NextResponse.json({ ok: false, error: verifyResult.error }, { status: 400 });
    }

    // Since we don't mint a session, we need to fetch the customer ID ourselves if verifyResult doesn't return it
    // Wait, verifyPortalOtp doesn't return customer if shouldMintSession=false. Let's get it by email.
    const customer = await db.customer.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    }
    const customerId = customer.id;

    const pepper = process.env.PASSWORD_PEPPER;
    if (!pepper) {
      logger.error({ event: "missing_password_pepper" }, "PASSWORD_PEPPER is not set");
      return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
    }

    const pepperedPassword = newPassword + pepper;
    const passwordHash = await hash(pepperedPassword, 12);

    await db.customer.update({
      where: { id: customerId },
      data: { passwordHash }
    });

    // Revoke all active sessions and refresh tokens for this customer (Issue 1.2)
    await db.customerSession.updateMany({
      where: { customerId },
      data: { isRevoked: true }
    });
    // customerRefreshToken is linked by sessionId, so we find sessions first
    const sessions = await db.customerSession.findMany({
      where: { customerId },
      select: { id: true }
    });
    if (sessions.length > 0) {
      await db.customerRefreshToken.updateMany({
        where: { sessionId: { in: sessions.map(s => s.id) } },
        data: { revoked: true }
      });
    }

    logger.info({ event: "customer_password_reset", customerId, email }, "Customer reset their password via OTP");

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, event: "portal_password_reset_confirm_error" }, "Error confirming password reset");
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
