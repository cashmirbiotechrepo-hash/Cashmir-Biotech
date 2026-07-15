import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Package } from "lucide-react";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerOrderDetail } from "@/lib/customer/portal";
import { PORTAL_STATUS_LABEL, toCustomerTimeline } from "@/lib/customer/portal-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Order detail · Customer Portal",
  robots: { index: false, follow: false }
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const PIPELINE = ["Placed", "Paid", "Preparing", "Shipped", "Delivered"] as const;

function pipelineIndex(status: string): number {
  switch (status) {
    case "delivered":
      return 4;
    case "shipped":
      return 3;
    case "processing":
      return 2;
    case "paid":
    case "partially_refunded":
      return 1;
    default:
      return 0;
  }
}

export default async function PortalOrderDetailPage({
  params
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await requireCustomerSession();
  const { orderNumber } = await params;
  const detail = await getCustomerOrderDetail(session.id, orderNumber);
  if (!detail) notFound();

  const { order, timeline } = detail;
  const activeIdx = pipelineIndex(order.status);
  const { customer: customerEvents, technical } = toCustomerTimeline(timeline);
  const title =
    order.items.length === 1
      ? order.items[0]!.productName
      : `${order.items[0]?.productName ?? "Order"} +${order.items.length - 1}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/portal/orders" className="inline-flex min-h-10 items-center text-[13px] text-ink-mute hover:text-ink">
          ← Orders
        </Link>
        <div className="mt-3 flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-pearl">
            {order.items[0]?.product?.imageUrl ? (
              <Image
                src={order.items[0].product.imageUrl}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1.5"
              />
            ) : (
              <div className="grid h-full place-items-center text-ink-faint">
                <Package className="h-6 w-6" strokeWidth={1.25} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[1.35rem] font-light leading-snug tracking-tight text-ink">{title}</h1>
            <p className="mt-1 text-[15px] font-medium tabular-nums text-ink">
              {inr.format(order.totalCents / 100)}
            </p>
            <p className="mt-1 text-[12px] text-ink-mute">
              {PORTAL_STATUS_LABEL[order.status] ?? order.status}
              <span className="text-ink-faint"> · {order.orderNumber}</span>
            </p>
          </div>
        </div>
        {(order.refundedCents ?? 0) > 0 ? (
          <p className="mt-3 border border-ink/10 bg-pearl/60 px-3 py-2 text-[13px] text-ink-mute" role="status">
            Refunded so far: {inr.format(order.refundedCents / 100)}
          </p>
        ) : null}
      </div>

      <section className="border border-ink/10 bg-paper p-4">
        <h2 className="text-[13px] font-medium text-ink-mute">Progress</h2>
        <ol className="mt-3 space-y-0">
          {PIPELINE.map((label, i) => {
            const done = i < activeIdx;
            const current = i === activeIdx;
            return (
              <li key={label} className="flex gap-3">
                <div className="flex w-4 flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 rounded-full",
                      done || current ? "bg-gold" : "bg-ink/15",
                      current && "ring-2 ring-gold/30 ring-offset-2 ring-offset-paper"
                    )}
                  />
                  {i < PIPELINE.length - 1 ? (
                    <span className={cn("w-px flex-1", done ? "bg-gold/50" : "bg-ink/10")} />
                  ) : null}
                </div>
                <p
                  className={cn(
                    "pb-3 text-[14px]",
                    current ? "font-medium text-ink" : done ? "text-ink" : "text-ink-faint"
                  )}
                >
                  {label}
                </p>
              </li>
            );
          })}
        </ol>
        {order.trackingNumber ? (
          <p className="mt-1 border-t border-ink/8 pt-3 text-[13px] text-ink-mute">
            {order.carrier ? `${order.carrier} · ` : ""}
            Tracking {order.trackingNumber}
          </p>
        ) : null}
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        {order.invoices[0]?.pdfUrl ? (
          <a
            href={order.invoices[0].pdfUrl}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-ink/12 bg-paper text-[13px] font-medium text-ink"
          >
            <Download className="h-4 w-4" />
            Download invoice
          </a>
        ) : null}
        <Link
          href="/portal/support"
          className="inline-flex min-h-11 items-center justify-center border border-ink/12 bg-paper text-[13px] font-medium text-ink"
        >
          Contact support
        </Link>
        {order.items[0]?.product?.slug ? (
          <Link
            href={`/products/${order.items[0].product.slug}`}
            className="inline-flex min-h-11 items-center justify-center bg-ink text-[13px] font-medium text-paper sm:col-span-2"
          >
            Reorder
          </Link>
        ) : null}
      </div>

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Items</h2>
        <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3 px-3 py-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden bg-pearl">
                {item.product?.imageUrl ? (
                  <Image
                    src={item.product.imageUrl}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">{item.productName}</p>
                <p className="mt-0.5 text-[12px] text-ink-mute">
                  Qty {item.quantity}
                  {item.product?.sizeLabel ? ` · ${item.product.sizeLabel}` : ""}
                </p>
              </div>
              <p className="text-[13px] tabular-nums text-ink">
                {inr.format((item.unitPriceCents * item.quantity) / 100)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {customerEvents.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Updates</h2>
          <ol className="border border-ink/10 bg-paper px-4 py-3">
            {customerEvents.map((e, i) => (
              <li key={e.id} className="flex gap-3">
                <div className="flex w-3 flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-gold" />
                  {i < customerEvents.length - 1 ? <span className="w-px flex-1 bg-ink/10" /> : null}
                </div>
                <div className="min-w-0 pb-3">
                  <p className="text-[14px] text-ink">{e.title}</p>
                  {e.detail ? <p className="text-[12px] text-ink-mute">{e.detail}</p> : null}
                  <p className="mt-0.5 text-[12px] text-ink-mute">
                    {e.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {technical.length > 0 ? (
        <details className="border border-ink/10 bg-paper px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-ink-mute">
            Technical history
          </summary>
          <ul className="mt-3 space-y-3 border-t border-ink/8 pt-3">
            {technical.map((e) => (
              <li key={e.id}>
                <p className="text-[13px] text-ink-soft">{e.title}</p>
                {e.detail ? <p className="text-[12px] text-ink-faint">{e.detail}</p> : null}
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {e.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
