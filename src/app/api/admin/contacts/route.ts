import { adminErr, adminOk, requireAdminApi } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { contactSchema } from "@/modules/admin/validations/phase2";

export async function GET() {
  const { error } = await requireAdminApi();
  if (error) return error;
  const contacts = await db.contact.findMany({ orderBy: { updatedAt: "desc" } });
  return adminOk(contacts);
}

export async function POST(req: Request) {
  const { admin, error } = await requireAdminApi();
  if (error || !admin) return error!;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return adminErr("invalid_json", "Invalid JSON body.");
  }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return adminErr("validation_error", parsed.error.issues[0]?.message ?? "Invalid contact.");
  }
  const contact = await db.contact.create({ data: parsed.data });
  return adminOk(contact);
}
