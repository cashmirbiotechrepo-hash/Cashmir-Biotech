import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerOrders } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Orders · Research Portal",
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

export default async function PortalOrdersPage() {
  const session = await requireCustomerSession();
  const orders = await getCustomerOrders(session.id);

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Orders & tracking</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-ink">My formulations</h1>
      </header>

      {orders.length === 0 ? (
        <p className="text-sm text-ink-mute">
          No orders yet.{" "}
          <Link href="/products" className="text-ink underline-offset-4 hover:underline">
            Explore the catalog
          </Link>
        </p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const title =
              order.items.length === 1
                ? order.items[0]!.productName
                : `${order.items[0]?.productName ?? "Order"} +${order.items.length - 1}`;
            return (
              <li key={order.id}>
                <Link
                  href={`/portal/orders/${order.orderNumber}`}
                  className="block rounded-2xl border border-ink/10 bg-paper/70 p-6 transition hover:border-ink/25 md:p-7"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-light text-ink">{title}</p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                        {order.orderNumber}
                      </p>
                    </div>
                    <p className="text-sm text-ink">{inr.format(order.totalCents / 100)}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    <span className="text-xs text-ink-mute">View details →</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
