import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_REFRESH_COOKIE, ADMIN_RESTORE_GUARD_COOKIE } from "@/config/auth.constants";
import { setAdminSessionCookies } from "@/lib/auth";
import { AdminTokenService } from "@/lib/admin/tokens";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: { code: "no_refresh", message: "No refresh token." } }, { status: 401 });
  }

  const rotated = await AdminTokenService.rotateRefreshToken(refreshToken);

  if (rotated.status === "raced") {
    // A concurrent request already rotated this token and set fresh cookies.
    // Do not touch cookies here or we would clobber the winner's Set-Cookie.
    return NextResponse.json({ data: { ok: true } }, { headers: { "Cache-Control": "no-store" } });
  }

  if (rotated.status === "unavailable") {
    // Transient DB blip — keep cookies so keepalive can retry without forced logout.
    return NextResponse.json(
      { error: { code: "unavailable", message: "Temporarily unavailable." } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (rotated.status === "invalid") {
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

/** Only same-origin console paths — never an absolute/protocol-relative URL (open redirect). */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/admin/dashboard";
  }
  return raw;
}

/**
 * Silent session restore for full-page navigations. Middleware redirects here
 * when the access cookie is missing/expired but a refresh cookie exists, so a
 * page reload after >15 minutes resumes the session instead of forcing login.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = safeNextPath(url.searchParams.get("next"));
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(ADMIN_REFRESH_COOKIE)?.value;

  const loginUrl = new URL("/admin/login", url.origin);
  loginUrl.searchParams.set("next", nextPath);

  if (!refreshToken) {
    return NextResponse.redirect(loginUrl, { headers: { "Cache-Control": "no-store" } });
  }

  const rotated = await AdminTokenService.rotateRefreshToken(refreshToken);

  if (rotated.status === "rotated") {
    await setAdminSessionCookies(rotated.accessToken, rotated.refreshToken);
    cookieStore.delete(ADMIN_RESTORE_GUARD_COOKIE);
    return NextResponse.redirect(new URL(nextPath, url.origin), {
      headers: { "Cache-Control": "no-store" }
    });
  }

  if (rotated.status === "raced" || rotated.status === "unavailable") {
    // Another request holds the fresh cookies, or a transient blip — go back and
    // let middleware re-check rather than destroying a healthy session.
    return NextResponse.redirect(new URL(nextPath, url.origin), {
      headers: { "Cache-Control": "no-store" }
    });
  }

  cookieStore.delete(ADMIN_REFRESH_COOKIE);
  loginUrl.searchParams.set("expired", "1");
  return NextResponse.redirect(loginUrl, { headers: { "Cache-Control": "no-store" } });
}
