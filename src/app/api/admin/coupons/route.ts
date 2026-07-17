import { adminErr, adminOk, requireAdminRole } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { couponSchema } from "@/modules/admin/validations/phase2";
import { requireJsonContent } from "@/lib/api-utils";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return adminOk(coupons);
}

export async function POST(req: Request) {
  const invalidType = requireJsonContent(req);
  if (invalidType) return invalidType;

  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return adminErr("invalid_json", "Invalid JSON body.");
  }
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) {
    return adminErr("validation_error", parsed.error.issues[0]?.message ?? "Invalid coupon.");
  }
  const { maxUses, expiresAt, ...data } = parsed.data;
  const coupon = await db.coupon.create({
    data: {
      ...data,
      maxUses: typeof maxUses === "number" ? maxUses : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    }
  });
  return adminOk(coupon);
}
