import { NextResponse } from "next/server";
import { generatePoWChallenge } from "@/lib/admin/pow";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const challenge = await generatePoWChallenge();
    return NextResponse.json(challenge, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache"
      }
    });
  } catch {
    return NextResponse.json({ error: "Security challenge unavailable." }, { status: 503 });
  }
}
