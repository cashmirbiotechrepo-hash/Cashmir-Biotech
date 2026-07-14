import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/config/auth.constants";
import { verifyAdminSessionToken } from "@/lib/auth-edge";
import {
  clientIpFromRequest,
  getAdminLoginRatelimit,
  getAdminUploadRatelimit,
  getCheckoutRatelimit,
  getNewsletterRatelimit,
  getPortalOtpRatelimit
} from "@/lib/rate-limit-edge";

const HONEYPOT = ["/wp-admin", "/.env", "/.git", "/phpmyadmin", "/wp-login.php"];
const SQL_PATTERNS = [/(\bunion\b.*\bselect\b)/i, /(\bor\b\s+1\s*=\s*1)/i, /(--|#|\/\*)/];
const XSS_PATTERNS = [/<script/i, /javascript:/i, /on\w+\s*=/i];

function attachSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';"
  );
  return res;
}

function isSuspiciousUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (HONEYPOT.some((p) => lower.includes(p))) return true;
  if (lower.includes("..") || lower.includes("%2e%2e")) return true;
  for (const p of [...SQL_PATTERNS, ...XSS_PATTERNS]) {
    if (p.test(url)) return true;
  }
  return false;
}

function isPublicAdminApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/admin/auth/pow-challenge") ||
    pathname.startsWith("/api/admin/auth/refresh")
  );
}

function isProtectedApi(pathname: string): boolean {
  if (!pathname.startsWith("/api/admin")) return false;
  if (pathname.startsWith("/api/admin/auth/login")) return false;
  if (isPublicAdminApi(pathname)) return false;
  return true;
}

function isMutatingMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

/** Block cross-origin state-changing API calls (CSRF). */
function originAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const fullUrl = request.nextUrl.href;

  if (isSuspiciousUrl(fullUrl)) {
    return attachSecurityHeaders(new NextResponse(null, { status: 403 }));
  }

  if (pathname === "/api/newsletter" && request.method === "POST") {
    const rl = getNewsletterRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return attachSecurityHeaders(
          NextResponse.json(
            { ok: false, error: "Too many requests. Please try again in a minute." },
            { status: 429 }
          )
        );
      }
    }
  }

  const isLoginPost =
    (pathname === "/admin/login" && request.method === "POST") ||
    (pathname === "/api/admin/auth/login" && request.method === "POST");

  if (isLoginPost) {
    const rl = getAdminLoginRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        if (pathname.startsWith("/api/")) {
          return attachSecurityHeaders(
            NextResponse.json({ error: "Too many login attempts." }, { status: 429 })
          );
        }
        const url = request.nextUrl.clone();
        url.searchParams.set("rateLimited", "1");
        return attachSecurityHeaders(NextResponse.redirect(url));
      }
    }
  }

  if (
    (pathname === "/api/portal/auth/otp/request" || pathname === "/api/portal/auth/otp/verify") &&
    request.method === "POST"
  ) {
    const rl = getPortalOtpRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return attachSecurityHeaders(
          NextResponse.json({ ok: false, error: "Too many attempts. Please wait a minute." }, { status: 429 })
        );
      }
    }
  }

  if (pathname === "/api/admin/upload" && request.method === "POST") {
    const rl = getAdminUploadRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return attachSecurityHeaders(
          NextResponse.json({ error: { code: "rate_limited", message: "Too many uploads." } }, { status: 429 })
        );
      }
    }
  }

  if (pathname === "/api/checkout" && request.method === "POST") {
    const rl = getCheckoutRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return attachSecurityHeaders(
          NextResponse.json({ ok: false, error: "Too many requests. Please slow down." }, { status: 429 })
        );
      }
    }
  }

  if (pathname.startsWith("/api/admin") && isMutatingMethod(request.method) && !isPublicAdminApi(pathname)) {
    if (!originAllowed(request)) {
      return attachSecurityHeaders(
        NextResponse.json({ error: { code: "forbidden", message: "Cross-origin request blocked." } }, { status: 403 })
      );
    }
  }

  // CSRF guard for public shop + portal mutations. Razorpay webhook excluded (signature-verified).
  if (
    (pathname === "/api/checkout" ||
      pathname === "/api/payment/verify" ||
      pathname.startsWith("/api/portal/auth/")) &&
    isMutatingMethod(request.method)
  ) {
    if (!originAllowed(request)) {
      return attachSecurityHeaders(
        NextResponse.json({ ok: false, error: "Cross-origin request blocked." }, { status: 403 })
      );
    }
  }

  const needsAuth =
    (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) ||
    isProtectedApi(pathname);

  if (needsAuth) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const payload = token ? await verifyAdminSessionToken(token) : null;
    if (!payload) {
      if (pathname.startsWith("/api/")) {
        return attachSecurityHeaders(
          NextResponse.json({ error: { code: "unauthorized", message: "Admin session required." } }, { status: 401 })
        );
      }
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", pathname + request.nextUrl.search);
      return attachSecurityHeaders(NextResponse.redirect(login));
    }
    if (pathname === "/admin/login" || pathname === "/admin") {
      return attachSecurityHeaders(NextResponse.redirect(new URL("/admin/dashboard", request.url)));
    }
  }

  return attachSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/admin/login",
    "/api/admin/:path*",
    "/api/newsletter",
    "/api/checkout",
    "/api/payment/:path*",
    "/api/portal/:path*"
  ]
};
