import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, FileText, Package, ShoppingBag, Truck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getPortalOverview } from "@/lib/customer/portal";
import { PORTAL_STATUS_LABEL, timeOfDayGreeting } from "@/lib/customer/portal-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Overview · Customer Portal",
  robots: { index: false, follow: false }
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const QUICK = [
  { href: "/portal/orders", label: "Orders", icon: Package },
  { href: "/portal/orders", label: "Tracking", icon: Truck },
  { href: "/portal/documents", label: "Invoices", icon: FileText },
  { href: "/products", label: "Shop again", icon: ShoppingBag }
] as const;

export default async function PortalOverviewPage() {
  const session = await requireCustomerSession();
  const data = await getPortalOverview(session.id);
  if (!data) return null;

  const firstName = (data.customer.name ?? data.customer.email.split("@")[0] ?? "there").split(
    " "
  )[0];
  const { stats, latest, orders } = data;
  const greeting = timeOfDayGreeting();

  const statusLabel = latest
    ? (PORTAL_STATUS_LABEL[latest.status] ?? latest.status)
    : null;
  const productTitle = latest
    ? `${latest.items[0]?.productName ?? "Order"}${
        latest.items.length > 1 ? ` +${latest.items.length - 1}` : ""
      }`
    : null;
  const thumb = latest?.items[0]?.product?.imageUrl;
  const invoice = latest?.invoices?.[0];
  const needsPayment = latest?.status === "pending" || latest?.status === "payment_failed";
  const canTrack =
    latest &&
    (latest.status === "shipped" || latest.status === "processing" || latest.status === "delivered");

  let contextLine = `${stats.orderCount} ${stats.orderCount === 1 ? "order" : "orders"}`;
  if (stats.spentCents > 0) contextLine += ` · ${inr.format(stats.spentCents / 100)} lifetime`;
  if (stats.unpaidCount > 0) {
    contextLine = `${stats.unpaidCount} need${stats.unpaidCount === 1 ? "s" : ""} attention`;
  } else if (stats.inTransit > 0) {
    contextLine = `${stats.inTransit} in transit · ${inr.format(stats.spentCents / 100)} lifetime`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 md:space-y-8">
      <header className="space-y-1">
        <h1 className="text-[1.65rem] font-light leading-tight tracking-tight text-ink md:text-3xl">
          {greeting}, {firstName}
        </h1>
        <p className="text-[13px] text-ink-mute">{contextLine}</p>
      </header>

      {latest && productTitle ? (
        <section className="border border-ink/12 bg-paper p-4 shadow-[0_8px_28px_-20px_rgba(17,17,17,0.45)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[12px] font-medium text-ink-mute">Latest order</p>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                needsPayment
                  ? "bg-amber-100 text-amber-900"
                  : latest.status === "shipped" || latest.status === "processing"
                    ? "bg-sky-100 text-sky-900"
                    : latest.status === "delivered"
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-ink/5 text-ink-soft"
              )}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-3 flex gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-pearl">
              {thumb ? (
                <Image src={thumb} alt="" fill sizes="64px" className="object-contain p-1.5" />
              ) : (
                <div className="grid h-full place-items-center text-ink-faint">
                  <Package className="h-6 w-6" strokeWidth={1.25} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium leading-snug text-ink">{productTitle}</p>
              <p className="mt-0.5 text-[13px] tabular-nums text-ink-mute">
                {inr.format(latest.totalCents / 100)}
              </p>
              <p className="mt-1 truncate text-[11px] text-ink-faint">{latest.orderNumber}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/portal/orders/${latest.orderNumber}`}
              className="inline-flex min-h-11 items-center justify-center gap-1 bg-ink px-4 text-[13px] font-medium text-paper"
            >
              {needsPayment ? "Complete payment" : canTrack ? "Track shipment" : "View order"}
              <ChevronRight className="h-4 w-4" />
            </Link>
            {invoice?.pdfUrl ? (
              <a
                href={invoice.pdfUrl}
                className="inline-flex min-h-11 items-center justify-center border border-ink/15 px-4 text-[13px] font-medium text-ink"
              >
                Download invoice
              </a>
            ) : (
              <Link
                href="/portal/documents"
                className="inline-flex min-h-11 items-center justify-center border border-ink/15 px-4 text-[13px] font-medium text-ink"
              >
                Invoices & CoAs
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="border border-dashed border-ink/15 bg-paper/60 px-4 py-8 text-center">
          <p className="text-[15px] text-ink">No orders yet</p>
          <p className="mt-1 text-[13px] text-ink-mute">Your purchases and invoices will appear here.</p>
          <Link
            href="/products"
            className="mt-5 inline-flex min-h-11 items-center justify-center bg-ink px-6 text-[13px] font-medium text-paper"
          >
            Browse catalog
          </Link>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          {QUICK.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex min-h-[3.25rem] items-center gap-2.5 border border-ink/10 bg-paper px-3 active:scale-[0.98] active:bg-pearl"
            >
              <Icon className="h-5 w-5 shrink-0 text-ink" strokeWidth={1.75} aria-hidden />
              <span className="flex-1 text-[13px] font-medium text-ink">{label}</span>
              <ChevronRight className="h-4 w-4 text-ink-faint" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 border border-ink/10 bg-paper p-3">
        <Stat label="Orders" value={String(stats.orderCount)} />
        <Stat label="Spent" value={inr.format(stats.spentCents / 100)} />
        <Stat label="In transit" value={String(stats.inTransit)} />
        <Stat label="Products" value={String(stats.formulationCount)} />
      </section>

      {orders.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-ink-mute">Recent orders</h2>
            <Link href="/portal/orders" className="text-[13px] font-medium text-ink">
              See all
            </Link>
          </div>
          <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
            {orders.slice(0, 3).map((order) => {
              const title =
                order.items.length === 1
                  ? order.items[0]!.productName
                  : `${order.items[0]?.productName ?? "Order"} +${order.items.length - 1}`;
              const img = order.items[0]?.product?.imageUrl;
              return (
                <li key={order.id}>
                  <Link
                    href={`/portal/orders/${order.orderNumber}`}
                    className="flex items-center gap-3 px-3 py-3 active:bg-pearl"
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden bg-pearl">
                      {img ? (
                        <Image src={img} alt="" fill sizes="44px" className="object-contain p-1" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{title}</p>
                      <p className="text-[12px] text-ink-mute">
                        {PORTAL_STATUS_LABEL[order.status] ?? order.status}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] tabular-nums text-ink">
                      {inr.format(order.totalCents / 100)}
                    </p>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="pb-2 text-center text-[13px]">
        <Link href="/portal/support" className="font-medium text-ink-mute underline-offset-4 hover:text-ink hover:underline">
          Need help?
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2">
      <p className="text-[11px] text-ink-mute">{label}</p>
      <p className="mt-0.5 text-[1.25rem] font-light tabular-nums tracking-tight text-ink">{value}</p>
    </div>
  );
}
