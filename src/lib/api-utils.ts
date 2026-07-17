import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Asserts that the request Content-Type is application/json (HIGH-14).
 * Returns null if valid, or a 415 Unsupported Media Type response if invalid.
 */
export function requireJsonContent(request: Request | NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }
  return null;
}
