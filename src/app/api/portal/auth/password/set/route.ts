import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireCustomerSession } from "@/lib/customer/auth";

export const runtime = "nodejs";

const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export async function POST(request: Request) {
  try {
    const customer = await requireCustomerSession();
    const body = await request.json();
    
    const result = setPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error.errors[0]?.message ?? "Invalid request" }, 
        { status: 400 }
      );
    }

    const currentCustomer = await db.customer.findUnique({
      where: { id: customer.id },
      select: { passwordHash: true }
    });

    if (!currentCustomer) {
      return NextResponse.json({ ok: false, error: "Customer not found." }, { status: 404 });
    }

    if (currentCustomer.passwordHash) {
      return NextResponse.json({ ok: false, error: "Password is already set." }, { status: 400 });
    }

    const pepper = process.env.PASSWORD_PEPPER;
    if (!pepper) {
      logger.error({ event: "missing_password_pepper" }, "PASSWORD_PEPPER is not set");
      return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
    }

    const pepperedPassword = result.data.password + pepper;
    const passwordHash = await hash(pepperedPassword, 12);

    await db.customer.update({
      where: { id: customer.id },
      data: { passwordHash }
    });

    logger.info({ event: "customer_password_set", customerId: customer.id }, "Customer set a password for the first time");
    
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, event: "portal_password_set_error" }, "Error setting password");
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
