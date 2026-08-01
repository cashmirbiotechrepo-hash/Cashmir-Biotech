import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createCustomerSessionFromOAuth } from "@/lib/customer/oauth-session";
import { CUSTOMER_SESSION_COOKIE, CUSTOMER_REFRESH_COOKIE } from "@/config/auth.constants";

export const runtime = "nodejs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required")
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 400 });
    }
    const { email, password } = result.data;
    const normalizedEmail = email.toLowerCase().trim();

    const customer = await db.customer.findUnique({
      where: { email: normalizedEmail }
    });

    if (!customer) {
      // Dummy compare to mitigate timing attacks against non-existent accounts
      await compare("dummy", "dummyhash");
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    if (!customer.active) {
      return NextResponse.json({ ok: false, error: "Account is inactive. Contact support." }, { status: 403 });
    }

    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      return NextResponse.json(
        { ok: false, error: "Account temporarily locked due to too many failed attempts. Try again later." },
        { status: 429 }
      );
    }

    if (!customer.passwordHash) {
      // Use the generic message. Wait, no, we can tell them to use OTP or OAuth because it's their own portal.
      // And we know the account exists, but we shouldn't reveal it if it doesn't.
      // But wait, if they don't have a password, they legitimately need to use another method.
      return NextResponse.json(
        { ok: false, error: "No password set. Use email code or sign in with Google/Apple." },
        { status: 401 }
      );
    }

    const pepper = process.env.PASSWORD_PEPPER;
    if (!pepper) {
      logger.error({ event: "missing_password_pepper" }, "PASSWORD_PEPPER is not set");
      return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
    }

    const pepperedPassword = password + pepper;
    const isValid = await compare(pepperedPassword, customer.passwordHash);

    if (!isValid) {
      const attempts = customer.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await db.customer.update({
        where: { id: customer.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null
        }
      });

      if (shouldLock) {
        logger.warn({ event: "customer_locked_out", customerId: customer.id }, "Customer locked out");
        return NextResponse.json(
          { ok: false, error: "Too many failed attempts. Account locked for 15 minutes." },
          { status: 429 }
        );
      }

      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    // Reset attempts on success
    if (customer.failedLoginAttempts > 0 || customer.lockedUntil) {
      await db.customer.update({
        where: { id: customer.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      });
    }

    // Create session (reusing logic from OAuth helper which does exactly what we need)
    const { accessToken, refreshToken } = await createCustomerSessionFromOAuth(customer.id, request);
    
    const isProd = process.env.NODE_ENV === "production";
    const jar = await cookies();
    jar.set(CUSTOMER_SESSION_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60
    });
    jar.set(CUSTOMER_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60
    });

    return NextResponse.json({ ok: true, next: "/portal" });
  } catch (err) {
    logger.error({ err, event: "portal_password_login_error" }, "Error in password login");
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
