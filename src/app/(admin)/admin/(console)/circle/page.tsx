import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ensureResearchCirclePlans } from "@/modules/shop/services/research-circle.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Research Circle" };

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export default async function AdminCirclePage() {
  await ensureResearchCirclePlans();
  const [plans, subs] = await Promise.all([
    db.researchCirclePlan.findMany({ orderBy: { priceCents: "asc" } }),
    db.researchCircleSubscription.findMany({
      include: {
        customer: { select: { email: true, name: true } },
        plan: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);

  return (
    <>
      <AdminPageHeader
        title="Research Circle"
        description="Membership plans and active subscriptions."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="text-foreground tabular-nums">{inr.format(p.priceCents / 100)}</p>
              <p className="mt-1">
                {p.intervalMonths} mo · {p.active ? "active" : "inactive"} · slug {p.slug}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {subs.length === 0 ? (
              <li className="py-2 text-muted-foreground">None yet.</li>
            ) : (
              subs.map((s) => (
                <li key={s.id} className="flex justify-between gap-4 py-2">
                  <span>
                    {s.customer.name || s.customer.email}
                    <span className="ml-2 text-xs text-muted-foreground">{s.plan.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.status} · until {s.currentPeriodEnd.toLocaleDateString("en-IN")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
