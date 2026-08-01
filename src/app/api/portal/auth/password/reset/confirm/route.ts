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

    // Verify OTP with purpose "password_reset"
    // verifyPortalOtp returns the customer object if successful and marks the OTP as used.
    const verifyResult = await verifyPortalOtp(email, code, undefined, "password_reset");
    
    if (!verifyResult.ok) {
      return NextResponse.json({ ok: false, error: verifyResult.error }, { status: 400 });
    }

    const customerId = verifyResult.customer.id;

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

    logger.info({ event: "customer_password_reset", customerId, email }, "Customer reset their password via OTP");

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, event: "portal_password_reset_confirm_error" }, "Error confirming password reset");
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
