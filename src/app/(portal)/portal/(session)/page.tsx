import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getPortalOverview } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Overview · Research Portal",
  robots: { index: false, follow: false }
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  processing: "Preparing",
  shipped: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  refunded: "Refunded"
};

export default async function PortalOverviewPage() {
  const session = await requireCustomerSession();
  const data = await getPortalOverview(session.id);
  if (!data) return null;

  const firstName = (data.customer.name ?? data.customer.email.split("@")[0] ?? "there").split(" ")[0];
  const { stats, latest, recentEvents } = data;

  return (
    <div className="space-y-12">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Hello {firstName}</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink md:text-4xl">Research Portal</h1>
      </header>

      <section className="grid gap-6 border-y border-ink/10 py-8 sm:grid-cols-4">
        <Stat label="Orders" value={String(stats.orderCount)} />
        <Stat label="Spent" value={inr.format(stats.spentCents / 100)} />
        <Stat label="Shipments" value={String(stats.inTransit)} />
        <Stat label="Formulations" value={String(stats.formulationCount)} />
      </section>

      {latest ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-lg font-light text-ink">Latest order</h2>
            <Link
              href={`/portal/orders/${latest.orderNumber}`}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold hover:text-ink"
            >
              Track →
            </Link>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-paper/70 p-6 md:p-8">
            <p className="text-xl font-light text-ink">
              {latest.items[0]?.productName ?? "Order"}
              {latest.items.length > 1 ? ` +${latest.items.length - 1}` : ""}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              {latest.orderNumber} · {STATUS_LABEL[latest.status] ?? latest.status}
            </p>
            <p className="mt-4 text-sm text-ink-mute">{inr.format(latest.totalCents / 100)}</p>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-ink/15 p-8 text-center">
          <p className="text-ink-mute">No formulations yet.</p>
          <Link href="/products" className="mt-4 inline-block text-sm text-ink underline-offset-4 hover:underline">
            Browse catalog
          </Link>
        </section>
      )}

      {recentEvents.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-light text-ink">Recent activity</h2>
          <ul className="space-y-3 border-l border-ink/10 pl-5">
            {recentEvents.map((e) => (
              <li key={e.id}>
                <p className="text-sm text-ink">{e.title}</p>
                {e.detail ? <p className="text-xs text-ink-faint">{e.detail}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          {latest ? (
            <>
              <Link href={`/portal/orders/${latest.orderNumber}`} className="portal-action">
                Track package
              </Link>
              <Link href="/portal/documents" className="portal-action">
                Download invoice
              </Link>
            </>
          ) : null}
          <Link href="/portal/support" className="portal-action">
            Contact support
          </Link>
          <Link href="/products" className="portal-action">
            Browse formulations
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-light tracking-tight text-ink">{value}</p>
    </div>
  );
}
