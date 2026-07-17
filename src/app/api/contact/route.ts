import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SITE_CONTACT } from "@/lib/site-contact";
import { requireJsonContent } from "@/lib/api-utils";
import { getContactRatelimit, clientIpFromRequest } from "@/lib/rate-limit-edge";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().default(""),
  company: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(10).max(4000)
});

export async function POST(request: Request) {
  const invalidType = requireJsonContent(request);
  if (invalidType) return invalidType;

  // PROJECT OMEGA / HIGH-01 FIX: Rate limit contact route to prevent SMTP saturation / email bombing
  const ip = clientIpFromRequest(request);
  const rl = getContactRatelimit();
  if (rl) {
    const { success } = await rl.limit(ip);
    if (!success) {
      logger.warn({ ip, event: "contact_rate_limited" }, "Contact form submission rate limited");
      return NextResponse.json({ ok: false, error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
    }
  }

  // PROJECT OMEGA / TOP-100 #6 FIX: Enforce payload volume limit (15 KB) to prevent memory flooding / DoS
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 15000) {
    return NextResponse.json({ ok: false, error: "Payload exceeds maximum allowed volume of 15 KB." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form fields." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  try {
    await db.contact.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        type: "lead",
        notes: data.message
      }
    });

    const { buildContactLeadMail } = await import("@/lib/email/transactional");
    const { sendTransactionalMail } = await import("@/lib/admin/mail");
    const mail = buildContactLeadMail({
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      message: data.message
    });
    await sendTransactionalMail({
      to: SITE_CONTACT.supportEmail || SITE_CONTACT.primaryEmail,
      mail
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, event: "contact_form_failed" }, "contact form failed");
    return NextResponse.json({ ok: false, error: "Could not send message." }, { status: 500 });
  }
}
