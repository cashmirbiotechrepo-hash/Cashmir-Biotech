import { NextResponse } from "next/server";
import { clearAdminSessionCookies, getCurrentAdmin } from "@/lib/auth";
import { AdminAuthService } from "@/lib/admin/auth-service";

export async function POST() {
  const admin = await getCurrentAdmin();
  if (admin?.sessionId) {
    await AdminAuthService.logout(admin.sessionId, admin.email);
  }
  await clearAdminSessionCookies();
  return NextResponse.json({ data: { ok: true } });
}

export async function GET() {
  return POST();
}
