import { NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().trim().email(),
  orderNumber: z.string().trim().min(6).max(40)
});

const verifySchema = requestSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/)
});

function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;

/**
 * Guest order lookup with email + order number + OTP.
 * Uniform responses avoid enumeration; confirmation token only after OTP verify.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const step = (body as { step?: string })?.step;
  if (step === "verify") return verifyLookup(body);
  return requestLookup(body);
}

async function requestLookup(body: unknown) {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email and order number." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const orderNumber = parsed.data.orderNumber.toUpperCase();
  const purpose = `order_lookup:${orderNumber}`;
  const uniform = NextResponse.json({
    ok: true,
    step: "otp",
    message: "If that order matches, we sent a 6-digit code to your email."
  });

  try {
    const recent = await db.customerOtp.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: "desc" }
    });
    if (recent && recent.createdAt.getTime() > Date.now() - OTP_COOLDOWN_MS) {
      return uniform;
    }

    const order = await db.order.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: "insensitive" },
        customerEmail: { equals: email, mode: "insensitive" },
        confirmationToken: { not: "" }
      },
      select: { orderNumber: true, customerEmail: true }
    });

    const code = String(randomInt(100000, 999999));
    await db.customerOtp.create({
      data: {
        email,
        purpose,
        codeHash: hashOtp(code),
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS)
      }
    });

    if (order?.customerEmail) {
      const { sendOtpMail } = await import("@/lib/admin/mail");
      await sendOtpMail({
        to: order.customerEmail,
        kind: "order_lookup",
        code,
        orderNumber: order.orderNumber
      }).catch((err) => logger.warn({ err }, "order lookup otp mail failed"));
    }
  } catch (err) {
    logger.error({ err, event: "order_lookup_request_failed" }, "order lookup request failed");
  }

  return uniform;
}

async function verifyLookup(body: unknown) {
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const orderNumber = parsed.data.orderNumber.toUpperCase();
  const purpose = `order_lookup:${orderNumber}`;
  const codeHash = hashOtp(parsed.data.code);

  const otp = await db.customerOtp.findFirst({
    where: { email, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });

  if (!otp || otp.attempts >= 5) {
    return NextResponse.json({ ok: false, error: "Invalid or expired code." }, { status: 400 });
  }

  if (otp.codeHash !== codeHash) {
    await db.customerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ ok: false, error: "Invalid or expired code." }, { status: 400 });
  }

  await db.customerOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

  const order = await db.order.findFirst({
    where: {
      orderNumber: { equals: orderNumber, mode: "insensitive" },
      customerEmail: { equals: email, mode: "insensitive" },
      confirmationToken: { not: "" }
    },
    select: { orderNumber: true, confirmationToken: true }
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    redirectTo: `/order/${order.orderNumber}?t=${order.confirmationToken}`
  });
}
