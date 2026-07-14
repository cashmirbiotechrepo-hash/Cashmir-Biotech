import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerOrders } from "@/lib/customer/portal";
import { db } from "@/lib/db";
import { PortalSupportForm } from "@/components/portal/portal-support-form";

export const metadata: Metadata = {
  title: "Support · Customer Portal",
  robots: { index: false, follow: false }
};

export default async function PortalSupportPage() {
  const session = await requireCustomerSession();
  const [orders, tickets] = await Promise.all([
    getCustomerOrders(session.id),
    db.supportTicket.findMany({
      where: { customerId: session.id },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);
  const recent = orders.slice(0, 8);

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Help</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink">Support</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-mute">
          Open an in-app ticket with order context — our lab team is notified by email.
        </p>
      </header>

      <PortalSupportForm
        orderOptions={recent.map((o) => ({
          orderNumber: o.orderNumber,
          label: `${o.orderNumber} · ${o.items[0]?.productName ?? "Order"}`
        }))}
      />

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Your tickets</h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-ink-mute">No tickets yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {tickets.map((t) => (
              <li key={t.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-ink">{t.subject}</p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    {t.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-mute">
                  {t.topic}
                  {t.orderNumber ? (
                    <>
                      {" · "}
                      <Link href={`/portal/orders/${t.orderNumber}`} className="underline-offset-4 hover:underline">
                        {t.orderNumber}
                      </Link>
                    </>
                  ) : null}
                  {" · "}
                  {t.createdAt.toLocaleDateString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
