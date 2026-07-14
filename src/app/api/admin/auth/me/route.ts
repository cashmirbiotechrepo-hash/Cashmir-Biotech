import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in." } }, { status: 401 });
  }

  const user = await db.adminUser.findFirst({
    where: { id: admin.id, active: true },
    select: { id: true, email: true, name: true, role: true, isTwoFactorEnabled: true, lastLoginAt: true }
  });

  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Account not found." } }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      ...user,
      sessionId: admin.sessionId
    }
  });
}
