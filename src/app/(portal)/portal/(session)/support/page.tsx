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
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-[1.65rem] font-light tracking-tight text-ink">Support</h1>
        <p className="mt-1 text-[13px] text-ink-mute">
          Open a ticket with order context — we reply by email.
        </p>
      </header>

      <PortalSupportForm
        orderOptions={recent.map((o) => ({
          orderNumber: o.orderNumber,
          label: `${o.items[0]?.productName ?? "Order"} · ${o.orderNumber}`
        }))}
      />

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Your tickets</h2>
        {tickets.length === 0 ? (
          <p className="text-[13px] text-ink-mute">No tickets yet.</p>
        ) : (
          <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
            {tickets.map((t) => (
              <li key={t.id} className="px-3 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-medium text-ink">{t.subject}</p>
                  <span className="text-[12px] capitalize text-ink-mute">{t.status}</span>
                </div>
                <p className="mt-1 text-[12px] text-ink-mute">
                  {t.topic}
                  {t.orderNumber ? (
                    <>
                      {" · "}
                      <Link
                        href={`/portal/orders/${t.orderNumber}`}
                        className="underline-offset-4 hover:underline"
                      >
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
