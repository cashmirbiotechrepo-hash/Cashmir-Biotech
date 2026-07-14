import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerOrders } from "@/lib/customer/portal";
import { SITE_CONTACT } from "@/lib/site-contact";

export const metadata: Metadata = {
  title: "Support · Research Portal",
  robots: { index: false, follow: false }
};

const TOPICS = [
  { id: "shipment", label: "Shipment", subject: "Shipment help" },
  { id: "refund", label: "Refund", subject: "Refund request" },
  { id: "quality", label: "Quality", subject: "Product quality" },
  { id: "question", label: "Question", subject: "General question" }
] as const;

export default async function PortalSupportPage() {
  const session = await requireCustomerSession();
  const orders = await getCustomerOrders(session.id);
  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Help</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink">Support</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-mute">
          Pick an order and a topic — we&apos;ll open a pre-filled email so context is never lost.
        </p>
      </header>

      {recent.length === 0 ? (
        <p className="text-sm text-ink-mute">
          No orders yet.{" "}
          <a href={`mailto:${SITE_CONTACT.primaryEmail}`} className="text-ink underline-offset-4 hover:underline">
            Email us anytime
          </a>
        </p>
      ) : (
        <ul className="space-y-6">
          {recent.map((order) => (
            <li key={order.id} className="rounded-2xl border border-ink/10 bg-paper/60 p-5 md:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-base font-light text-ink">
                  {order.items[0]?.productName ?? order.orderNumber}
                </p>
                <Link
                  href={`/portal/orders/${order.orderNumber}`}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                >
                  {order.orderNumber}
                </Link>
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Need help?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TOPICS.map((t) => {
                  const href = `mailto:${SITE_CONTACT.primaryEmail}?subject=${encodeURIComponent(
                    `${t.subject} · ${order.orderNumber}`
                  )}&body=${encodeURIComponent(
                    `Order: ${order.orderNumber}\nEmail: ${session.email}\nTopic: ${t.label}\n\n`
                  )}`;
                  return (
                    <a
                      key={t.id}
                      href={href}
                      className="rounded-full border border-ink/15 px-4 py-2 text-xs text-ink-mute transition hover:border-ink/30 hover:text-ink"
                    >
                      {t.label}
                    </a>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
