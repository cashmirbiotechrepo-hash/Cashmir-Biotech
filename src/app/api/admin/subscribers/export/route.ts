import { requireAdminRole } from "@/lib/admin/api";
import { cursorPages, streamCsvResponse } from "@/lib/admin/csv";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdminRole(["owner", "admin"]);
  if (error) return error;

  const header = ["email", "source", "status", "joinedAt", "unsubscribedAt"];

  async function* rows() {
    for await (const s of cursorPages((args) =>
      db.subscriber.findMany({
        ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
        take: args.take,
        orderBy: { id: "desc" }
      })
    )) {
      yield [
        s.email,
        s.source,
        s.status,
        s.createdAt.toISOString(),
        s.unsubscribedAt?.toISOString() ?? ""
      ];
    }
  }

  return streamCsvResponse("subscribers-{date}.csv", header, rows());
}
