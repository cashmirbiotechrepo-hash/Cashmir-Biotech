import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerOrders } from "@/lib/customer/portal";
import { PORTAL_STATUS_LABEL } from "@/lib/customer/portal-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Orders · Customer Portal",
  robots: { index: false, follow: false }
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function statusTone(status: string) {
  if (status === "pending" || status === "payment_failed") return "bg-amber-100 text-amber-900";
  if (status === "shipped" || status === "processing") return "bg-sky-100 text-sky-900";
  if (status === "delivered") return "bg-emerald-100 text-emerald-900";
  if (status === "cancelled" || status === "refunded") return "bg-ink/5 text-ink-mute";
  return "bg-ink/5 text-ink-soft";
}

export default async function PortalOrdersPage() {
  const session = await requireCustomerSession();
  const orders = await getCustomerOrders(session.id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-[1.65rem] font-light tracking-tight text-ink">Orders</h1>
        <p className="mt-1 text-[13px] text-ink-mute">Status, tracking, and reorder.</p>
      </header>

      {orders.length === 0 ? (
        <div className="border border-dashed border-ink/15 px-4 py-10 text-center">
          <p className="text-[15px] text-ink">No orders yet</p>
          <Link
            href="/products"
            className="mt-4 inline-flex min-h-11 items-center bg-ink px-5 text-[13px] font-medium text-paper"
          >
            Explore the catalog
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
          {orders.map((order) => {
            const title =
              order.items.length === 1
                ? order.items[0]!.productName
                : `${order.items[0]?.productName ?? "Order"} +${order.items.length - 1}`;
            const img = order.items[0]?.product?.imageUrl;
            const when = new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            });
            return (
              <li key={order.id}>
                <Link
                  href={`/portal/orders/${order.orderNumber}`}
                  className="flex items-center gap-3 px-3 py-3.5 active:bg-pearl"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-pearl">
                    {img ? (
                      <Image src={img} alt="" fill sizes="56px" className="object-contain p-1.5" />
                    ) : (
                      <div className="grid h-full place-items-center text-ink-faint">
                        <Package className="h-5 w-5" strokeWidth={1.25} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[15px] font-medium text-ink">{title}</p>
                      <p className="shrink-0 text-[14px] tabular-nums text-ink">
                        {inr.format(order.totalCents / 100)}
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          statusTone(order.status)
                        )}
                      >
                        {PORTAL_STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      <span className="text-[12px] text-ink-mute">{when}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
