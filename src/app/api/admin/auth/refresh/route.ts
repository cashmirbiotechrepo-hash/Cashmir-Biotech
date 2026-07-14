import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_REFRESH_COOKIE } from "@/config/auth.constants";
import { setAdminSessionCookies } from "@/lib/auth";
import { AdminTokenService } from "@/lib/admin/tokens";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: { code: "no_refresh", message: "No refresh token." } }, { status: 401 });
  }

  const rotated = await AdminTokenService.rotateRefreshToken(refreshToken);
  if (!rotated) {
    cookieStore.delete(ADMIN_REFRESH_COOKIE);
    return NextResponse.json({ error: { code: "invalid_refresh", message: "Session expired." } }, { status: 401 });
  }

  await setAdminSessionCookies(rotated.accessToken, rotated.refreshToken);

  return NextResponse.json(
    { data: { ok: true } },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
