import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "@/config/auth.constants";
import { verifyAdminSessionToken, verifyCustomerSessionToken } from "@/lib/auth-edge";
import {
  clientIpFromRequest,
  getAdminLoginRatelimit,
  getAdminUploadRatelimit,
  getCheckoutRatelimit,
  getNewsletterRatelimit,
  getOrderLookupRatelimit,
  getPaymentVerifyRatelimit,
  getPortalOtpRatelimit,
  getToolsRatelimit,
  getWebhookRatelimit
} from "@/lib/rate-limit-edge";

const HONEYPOT = ["/wp-admin", "/.env", "/.git", "/phpmyadmin", "/wp-login.php"];
const SQL_PATTERNS = [/(\bunion\b.*\bselect\b)/i, /(\bor\b\s+1\s*=\s*1)/i, /(--|#|\/\*)/];
const XSS_PATTERNS = [/<script/i, /javascript:/i, /on\w+\s*=/i];

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://api.razorpay.com`
    : `script-src 'self' 'nonce-${nonce}' https://checkout.razorpay.com https://api.razorpay.com`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: https://api.razorpay.com https://lumberjack.razorpay.com *.ingest.sentry.io",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://maps.google.com https://www.google.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");
}

function attachSecurityHeaders(res: NextResponse, req: NextRequest | undefined, nonce: string) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  res.headers.set("Content-Security-Policy", buildCsp(nonce));

  if (req?.nextUrl.pathname.startsWith("/api/tools/")) {
    const origin = req.headers.get("origin") || "";
    const configured = process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
    if (process.env.NODE_ENV === "production") {
      // Fail closed: no CORS wildcard in production. Same-origin requests omit Origin and need no ACAO.
      if (origin && configured.includes(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Vary", "Origin");
        res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
      }
    } else {
      const allowed = configured.length > 0 ? configured : ["*"];
      res.headers.set(
        "Access-Control-Allow-Origin",
        allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : allowed[0]
      );
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
    }
  }

  const reqId = req?.headers.get("x-request-id") || crypto.randomUUID();
  res.headers.set("X-Request-Id", reqId);
  return res;
}

/** NextResponse.next with CSP nonce forwarded so Next can stamp its scripts. */
function nextWithNonce(request: NextRequest, nonce: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  return attachSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), request, nonce);
}

function deny(request: NextRequest, nonce: string, status: number, body?: object) {
  const res = body
    ? NextResponse.json(body, { status })
    : new NextResponse(null, { status });
  return attachSecurityHeaders(res, request, nonce);
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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const { pathname } = request.nextUrl;
  const fullUrl = request.nextUrl.href;

  if (isSuspiciousUrl(fullUrl)) {
    return deny(request, nonce, 403);
  }

  if (request.method === "OPTIONS" && pathname.startsWith("/api/tools/")) {
    return deny(request, nonce, 200);
  }

  if (pathname.startsWith("/api/webhooks/")) {
    const rl = getWebhookRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return deny(request, nonce, 429, { ok: false, error: "Too many webhook requests." });
      }
    }
  }

  if (pathname === "/api/newsletter" && request.method === "POST") {
    const rl = getNewsletterRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return deny(request, nonce, 429, {
          ok: false,
          error: "Too many requests. Please try again in a minute."
        });
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
          return deny(request, nonce, 429, { error: "Too many login attempts." });
        }
        const url = request.nextUrl.clone();
        url.searchParams.set("rateLimited", "1");
        return attachSecurityHeaders(NextResponse.redirect(url), request, nonce);
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
        return deny(request, nonce, 429, { ok: false, error: "Too many attempts. Please wait a minute." });
      }
    }
  }

  if (pathname === "/api/admin/upload" && request.method === "POST") {
    const rl = getAdminUploadRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return deny(request, nonce, 429, {
          error: { code: "rate_limited", message: "Too many uploads." }
        });
      }
    }
  }

  if (pathname === "/api/checkout" && request.method === "POST") {
    const rl = getCheckoutRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return deny(request, nonce, 429, { ok: false, error: "Too many requests. Please slow down." });
      }
    }
  }

  if (pathname === "/api/order/lookup" && request.method === "POST") {
    const rl = getOrderLookupRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return deny(request, nonce, 429, { ok: false, error: "Too many lookup attempts. Please wait a minute." });
      }
    }
  }

  if (pathname === "/api/payment/verify" && request.method === "POST") {
    const rl = getPaymentVerifyRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return deny(request, nonce, 429, { ok: false, error: "Too many verification attempts." });
      }
    }
  }

  if (pathname.startsWith("/api/tools/") && request.method === "POST") {
    const rl = getToolsRatelimit();
    if (rl) {
      const ip = clientIpFromRequest(request);
      const { success } = await rl.limit(ip);
      if (!success) {
        return deny(request, nonce, 429, { ok: false, error: "Too many tool requests. Please slow down." });
      }
    }
  }

  if (pathname.startsWith("/api/admin") && isMutatingMethod(request.method) && !isPublicAdminApi(pathname)) {
    if (!originAllowed(request)) {
      return deny(request, nonce, 403, {
        error: { code: "forbidden", message: "Cross-origin request blocked." }
      });
    }
  }

  if (
    (pathname === "/api/checkout" ||
      pathname === "/api/payment/verify" ||
      pathname === "/api/newsletter" ||
      pathname === "/api/contact" ||
      pathname.startsWith("/api/order/") ||
      pathname.startsWith("/api/portal/") ||
      pathname.startsWith("/api/tools/")) &&
    isMutatingMethod(request.method)
  ) {
    if (!originAllowed(request)) {
      return deny(request, nonce, 403, { ok: false, error: "Cross-origin request blocked." });
    }
  }

  const isPortalProtected =
    pathname.startsWith("/portal") &&
    !pathname.startsWith("/portal/login") &&
    !pathname.startsWith("/portal/invite");
  if (isPortalProtected) {
    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const payload = token ? await verifyCustomerSessionToken(token) : null;
    if (!payload) {
      const login = new URL("/portal/login", request.url);
      login.searchParams.set("next", pathname + request.nextUrl.search);
      return attachSecurityHeaders(NextResponse.redirect(login), request, nonce);
    }
  }

  if (pathname === "/portal/login") {
    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const payload = token ? await verifyCustomerSessionToken(token) : null;
    if (payload) {
      return attachSecurityHeaders(NextResponse.redirect(new URL("/portal", request.url)), request, nonce);
    }
  }

  const needsAuth =
    (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) || isProtectedApi(pathname);

  if (needsAuth) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const payload = token ? await verifyAdminSessionToken(token) : null;
    if (!payload) {
      if (pathname.startsWith("/api/")) {
        return deny(request, nonce, 401, {
          error: { code: "unauthorized", message: "Admin session required." }
        });
      }
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", pathname + request.nextUrl.search);
      return attachSecurityHeaders(NextResponse.redirect(login), request, nonce);
    }
    if (pathname === "/admin/login" || pathname === "/admin") {
      return attachSecurityHeaders(NextResponse.redirect(new URL("/admin/dashboard", request.url)), request, nonce);
    }
  }

  return nextWithNonce(request, nonce);
}

export const config = {
  matcher: [
    /*
     * Site-wide CSP nonces + security headers (skip Next static assets).
     * Auth / rate-limit branches still gate on path prefix inside middleware.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"
  ]
};
