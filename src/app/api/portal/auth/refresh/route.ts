import { NextResponse } from "next/server";
import {
  rotateCustomerRefresh,
  setCustomerSessionCookies,
  clearCustomerSessionCookies
} from "@/lib/customer/auth";
import { CUSTOMER_REFRESH_COOKIE } from "@/config/auth.constants";

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
