import { NextResponse } from "next/server";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireCustomerSession } from "@/lib/customer/auth";

export const runtime = "nodejs";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"]
});

export async function POST(request: Request) {
  try {
    const customer = await requireCustomerSession();
    const body = await request.json();
    
    const result = changePasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error.errors[0]?.message ?? "Invalid request" }, 
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = result.data;

    const currentCustomer = await db.customer.findUnique({
      where: { id: customer.id },
      select: { passwordHash: true }
    });

    if (!currentCustomer) {
      return NextResponse.json({ ok: false, error: "Customer not found." }, { status: 404 });
    }

    if (!currentCustomer.passwordHash) {
      return NextResponse.json({ ok: false, error: "No password set. Use the set password endpoint." }, { status: 400 });
    }

    const pepper = process.env.PASSWORD_PEPPER;
    if (!pepper) {
      logger.error({ event: "missing_password_pepper" }, "PASSWORD_PEPPER is not set");
      return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
    }

    const isMatch = await compare(currentPassword + pepper, currentCustomer.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ ok: false, error: "Incorrect current password." }, { status: 400 });
    }

    const newPasswordHash = await hash(newPassword + pepper, 12);

    await db.customer.update({
      where: { id: customer.id },
      data: { passwordHash: newPasswordHash }
    });

    // Revoke other active sessions for security, but keep the current one
    await db.customerSession.updateMany({
      where: { customerId: customer.id, id: { not: customer.sessionId } },
      data: { isRevoked: true }
    });

    logger.info({ event: "customer_password_change", customerId: customer.id }, "Customer changed their password");
    
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, event: "customer_password_change_error" }, "Error changing password");
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
