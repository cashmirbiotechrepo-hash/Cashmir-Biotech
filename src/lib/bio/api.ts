import { NextResponse } from "next/server";

export const MAX_SEQ_LENGTH = 100_000;

export function ok<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/** Read + guard a JSON body; returns [body, errorResponse]. */
export async function readBody<T = Record<string, unknown>>(
  req: Request
): Promise<[T | null, ReturnType<typeof fail> | null]> {
  try {
    const body = (await req.json()) as T;
    return [body, null];
  } catch {
    return [null, fail("Invalid JSON body.")];
  }
}

export function guardSeq(seq: unknown, field = "sequence"): string | null {
  if (typeof seq !== "string" || seq.trim().length === 0) return `Missing ${field}.`;
  if (seq.length > MAX_SEQ_LENGTH) return `${field} exceeds ${MAX_SEQ_LENGTH} character limit.`;
  return null;
}
