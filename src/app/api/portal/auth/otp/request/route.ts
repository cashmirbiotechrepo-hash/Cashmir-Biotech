import { NextResponse } from "next/server";
import { z } from "zod";
import { requestMeta, requestPortalOtp } from "@/lib/customer/auth";
import { requireJsonContent } from "@/lib/api-utils";

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

  await requestMeta();
  const result = await requestPortalOtp(parsed.data.email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has orders with us, a code is on its way."
  });
}
