import { requireAdminRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const subscribers = await db.subscriber.findMany({ orderBy: { createdAt: "desc" } });

  const csv = toCsv(
    ["email", "source", "status", "joinedAt", "unsubscribedAt"],
    subscribers.map((s) => [
      s.email,
      s.source,
      s.status,
      s.createdAt.toISOString(),
      s.unsubscribedAt?.toISOString() ?? ""
    ])
  );

  return csvResponse(csv, "subscribers-{date}.csv");
}
