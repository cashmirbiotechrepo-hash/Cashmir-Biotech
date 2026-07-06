import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/config/auth.constants";
import { verifyAdminSessionToken } from "@/lib/auth-edge";
import { clientIpFromRequest, getAdminLoginRatelimit, getNewsletterRatelimit } from "@/lib/rate-limit-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/api/newsletter" && request.method === "POST") {
    const rl = getNewsletterRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return NextResponse.json(
          { ok: false, error: "Too many requests. Please try again in a minute." },
          { status: 429 }
        );
      }
    }
  }

  if (pathname === "/admin/login" && request.method === "POST") {
    const rl = getAdminLoginRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        const url = request.nextUrl.clone();
        url.searchParams.set("rateLimited", "1");
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname.startsWith("/admin/dashboard")) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token || !(await verifyAdminSessionToken(token))) {
      const login = new URL("/admin/login", request.url);
      const nextPath = request.nextUrl.pathname + request.nextUrl.search;
      login.searchParams.set("next", nextPath);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard", "/admin/dashboard/:path*", "/admin/login", "/api/newsletter"]
};
