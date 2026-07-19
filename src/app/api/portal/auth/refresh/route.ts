import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  rotateCustomerRefresh,
  setCustomerSessionCookies,
  clearCustomerSessionCookies
} from "@/lib/customer/auth";
import { CUSTOMER_REFRESH_COOKIE, CUSTOMER_RESTORE_GUARD_COOKIE } from "@/config/auth.constants";

export const runtime = "nodejs";

/** Rotates Customer Portal access token using the path-scoped refresh cookie. */
export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${CUSTOMER_REFRESH_COOKIE}=([^;]+)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (!raw) {
    return NextResponse.json({ ok: false, error: "No refresh session" }, { status: 401 });
  }

  const rotated = await rotateCustomerRefresh(raw);
  if (rotated.status === "raced") {
    return NextResponse.json({ ok: true });
  }
  if (rotated.status === "unavailable") {
    // Transient DB blip — keep cookies so the client can retry without a forced logout.
    return NextResponse.json({ ok: false, error: "Temporarily unavailable" }, { status: 503 });
  }
  if (rotated.status !== "rotated") {
    await clearCustomerSessionCookies().catch(() => undefined);
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }

  await setCustomerSessionCookies(rotated.accessToken, rotated.refreshToken);
  return NextResponse.json({ ok: true });
}

/** Only same-origin portal paths — never an absolute/protocol-relative URL (open redirect). */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/portal";
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
  const raw = cookieStore.get(CUSTOMER_REFRESH_COOKIE)?.value;

  const loginUrl = new URL("/portal/login", url.origin);
  loginUrl.searchParams.set("next", nextPath);

  if (!raw) {
    return NextResponse.redirect(loginUrl, { headers: { "Cache-Control": "no-store" } });
  }

  const rotated = await rotateCustomerRefresh(raw);

  if (rotated.status === "rotated") {
    await setCustomerSessionCookies(rotated.accessToken, rotated.refreshToken);
    cookieStore.delete(CUSTOMER_RESTORE_GUARD_COOKIE);
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

  await clearCustomerSessionCookies().catch(() => undefined);
  return NextResponse.redirect(loginUrl, { headers: { "Cache-Control": "no-store" } });
}
