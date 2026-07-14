import { NextResponse } from "next/server";
import { logoutCustomer } from "@/lib/customer/auth";

export async function POST() {
  await logoutCustomer();
  return NextResponse.json({ ok: true });
}
