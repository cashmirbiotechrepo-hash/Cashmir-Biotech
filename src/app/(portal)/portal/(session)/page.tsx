import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Heart, Package, Settings, Truck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getPortalOverview } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Overview · Customer Portal",
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
  refunded: "Refunded",
  partially_refunded: "Partially refunded"
};

const TILES = [
  { href: "/portal/orders", label: "Orders", detail: "History & status", icon: Package },
  { href: "/portal/documents", label: "Invoices & CoAs", detail: "Downloads", icon: FileText },
  { href: "/portal/orders", label: "Tracking", detail: "Shipments", icon: Truck },
  { href: "/products", label: "Shop again", detail: "Catalog", icon: Heart },
  { href: "/portal/addresses", label: "Addresses", detail: "Shipping", icon: Settings },
  { href: "/portal/support", label: "Support", detail: "Help desk", icon: FileText }
] as const;

export default async function PortalOverviewPage() {
  const session = await requireCustomerSession();
  const data = await getPortalOverview(session.id);
  if (!data) return null;

  const firstName = (data.customer.name ?? data.customer.email.split("@")[0] ?? "there").split(" ")[0];
  const { stats, latest, recentEvents } = data;

  return (
    <div className="space-y-12">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Customer Portal</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink md:text-4xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-2 text-sm text-ink-mute">
          {stats.orderCount} {stats.orderCount === 1 ? "order" : "orders"}
          {stats.inTransit > 0 ? ` · ${stats.inTransit} in transit` : ""}
          {stats.spentCents > 0 ? ` · ${inr.format(stats.spentCents / 100)} lifetime` : ""}
        </p>
      </header>

      <section className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ href, label, detail, icon: Icon }) => (
          <Link
            key={`${href}-${label}`}
            href={href}
            className="group flex items-start gap-3 bg-ivory p-5 transition-colors hover:bg-pearl/80"
          >
            <Icon className="mt-0.5 h-4 w-4 text-gold" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="text-[15px] font-medium text-ink group-hover:text-gold">{label}</p>
              <p className="mt-0.5 text-[12px] text-ink-faint">{detail}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 border-y border-ink/10 py-8 sm:grid-cols-4">
        <Stat label="Orders" value={String(stats.orderCount)} />
        <Stat label="Spent" value={inr.format(stats.spentCents / 100)} />
        <Stat label="In transit" value={String(stats.inTransit)} />
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
              View details →
            </Link>
          </div>
          <div className="border border-ink/10 bg-paper/70 p-6 md:p-8">
            <p className="text-xl font-light text-ink">
              {latest.items[0]?.productName ?? "Order"}
              {latest.items.length > 1 ? ` +${latest.items.length - 1}` : ""}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              {latest.orderNumber} · {STATUS_LABEL[latest.status] ?? latest.status}
            </p>
            <p className="mt-4 text-sm text-ink-mute">{inr.format(latest.totalCents / 100)}</p>
            {recentEvents.length > 0 ? (
              <ol className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-ink/8 pt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {recentEvents.slice(0, 5).map((e) => (
                  <li key={e.id} className="text-ink-mute">
                    {e.title}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="border border-dashed border-ink/15 p-8 text-center">
          <p className="text-ink-mute">No orders yet.</p>
          <Link href="/products" className="mt-4 inline-block text-sm text-ink underline-offset-4 hover:underline">
            Browse the catalog
          </Link>
        </section>
      )}
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
