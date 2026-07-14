import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { updateSupportTicketStatusAction } from "@/app/(admin)/admin/(console)/support-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Support tickets" };

async function setStatus(formData: FormData) {
  "use server";
  await updateSupportTicketStatusAction(formData);
}

export default async function AdminSupportPage() {
  const tickets = await db.supportTicket.findMany({
    include: { customer: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <>
      <AdminPageHeader title="Support tickets" description="Customer Portal support tickets." />
      <div className="space-y-4">
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
        ) : (
          tickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{t.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.customer.email}
                      {t.orderNumber ? ` · ${t.orderNumber}` : ""} · {t.topic} ·{" "}
                      {t.createdAt.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Badge variant="outline">{t.status}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                <div className="flex flex-wrap gap-2">
                  {(["open", "in_progress", "resolved", "closed"] as const).map((status) => (
                    <form key={status} action={setStatus}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value={status} />
                      <Button type="submit" variant="outline" size="sm" disabled={t.status === status}>
                        {status}
                      </Button>
                    </form>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
