import { NextResponse } from "next/server";
import { z } from "zod";
import { requestMeta, verifyPortalOtp } from "@/lib/customer/auth";

const bodySchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter your email and 6-digit code." }, { status: 400 });
  }

  const meta = await requestMeta();
  const result = await verifyPortalOtp(parsed.data.email, parsed.data.code, meta);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  return NextResponse.json({ ok: true, customer: { email: result.customer.email, name: result.customer.name } });
}
