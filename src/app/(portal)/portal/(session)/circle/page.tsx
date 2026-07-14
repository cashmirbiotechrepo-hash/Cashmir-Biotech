import { requireCustomerSession } from "@/lib/customer/auth";
import {
  getActiveCircleSubscription,
  listActiveCirclePlans
} from "@/modules/shop/services/research-circle.service";
import {
  cancelResearchCircleAction,
  joinResearchCircleAction,
  type ActionMsg
} from "@/app/(portal)/portal/(session)/org-circle-actions";
import { CircleJoinForm } from "@/components/portal/circle-join-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Research Circle" };

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export default async function PortalCirclePage() {
  const session = await requireCustomerSession();
  const [plans, active] = await Promise.all([
    listActiveCirclePlans(),
    getActiveCircleSubscription(session.id)
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Research Circle</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Membership for labs and independent researchers — priority CoA access, formulation briefs, and
          member notices.
        </p>
      </div>

      {active ? (
        <section className="border border-border/70 p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active membership</p>
          <h2 className="mt-1 text-lg font-medium">{active.plan.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Renews / ends {active.currentPeriodEnd.toLocaleDateString("en-IN")} · status {active.status}
          </p>
          <form action={cancelResearchCircleAction} className="mt-4">
            <Button type="submit" variant="outline" size="sm">
              Cancel membership
            </Button>
          </form>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <section key={plan.id} className="border border-border/70 p-6">
              <h2 className="text-lg font-medium">{plan.name}</h2>
              <p className="mt-1 text-2xl tabular-nums">{inr.format(plan.priceCents / 100)}</p>
              <p className="text-xs text-muted-foreground">per {plan.intervalMonths} months</p>
              <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">{plan.benefits}</p>
              <div className="mt-5">
                <CircleJoinForm
                  planId={plan.id}
                  action={joinResearchCircleAction as (
                    prev: ActionMsg,
                    formData: FormData
                  ) => Promise<ActionMsg>}
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
