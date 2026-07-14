import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerOrderDetail } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Order detail · Research Portal",
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

const PIPELINE = ["Placed", "Paid", "Invoice", "Packed", "Courier", "Out for delivery", "Delivered"] as const;

function pipelineIndex(status: string, hasInvoice: boolean): number {
  if (status === "delivered") return 6;
  if (status === "shipped") return 5;
  if (status === "processing") return 3;
  if (["paid", "processing", "shipped", "delivered"].includes(status)) {
    return hasInvoice ? 2 : 1;
  }
  return 0;
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
  const activeIdx = pipelineIndex(order.status, order.invoices.length > 0);

  return (
    <div className="space-y-12">
      <div>
        <Link
          href="/portal/orders"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
        >
          ← Orders
        </Link>
        <h1 className="mt-4 text-3xl font-light tracking-tight text-ink">
          {order.items[0]?.productName ?? "Order"}
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          {order.orderNumber} · {STATUS_LABEL[order.status] ?? order.status} · {inr.format(order.totalCents / 100)}
        </p>
      </div>

      <section>
        <h2 className="mb-5 text-lg font-light text-ink">Current status</h2>
        <ol className="space-y-0">
          {PIPELINE.map((label, i) => {
            const done = i <= activeIdx;
            return (
              <li key={label} className="flex gap-4">
                <div className="flex w-4 flex-col items-center">
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${done ? "bg-gold" : "bg-ink/15"}`}
                  />
                  {i < PIPELINE.length - 1 ? (
                    <span className={`w-px flex-1 ${done && i < activeIdx ? "bg-gold/50" : "bg-ink/10"}`} />
                  ) : null}
                </div>
                <p className={`pb-5 text-sm ${done ? "text-ink" : "text-ink-faint"}`}>{label}</p>
              </li>
            );
          })}
        </ol>
        {order.trackingNumber ? (
          <p className="mt-2 text-sm text-ink-mute">
            {order.carrier ? `${order.carrier} · ` : ""}
            Tracking {order.trackingNumber}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Items</h2>
        <ul className="space-y-4">
          {order.items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-ink/10 bg-paper/60 p-5">
              <p className="text-base font-light text-ink">{item.productName}</p>
              <dl className="mt-3 grid gap-2 text-sm text-ink-mute sm:grid-cols-2">
                {item.product?.sizeLabel ? (
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Size</dt>
                    <dd>{item.product.sizeLabel}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Qty</dt>
                  <dd>{item.quantity}</dd>
                </div>
                {item.product?.patent ? (
                  <div className="sm:col-span-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Research</dt>
                    <dd>
                      Patent · {item.product.patent.title}
                      {item.product.patent.applicationNumber
                        ? ` (${item.product.patent.applicationNumber})`
                        : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {item.product?.slug ? (
                <Link
                  href={`/products/${item.product.slug}`}
                  className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                >
                  View scientific documents →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {order.invoices.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-light text-ink">Documents</h2>
          <ul className="space-y-2">
            {order.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between border-b border-ink/10 py-3 text-sm">
                <span>Invoice {inv.invoiceNumber}</span>
                {inv.pdfUrl ? (
                  <a href={inv.pdfUrl} className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-ink-faint">On file</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-light text-ink">Timeline</h2>
        <ul className="space-y-4 border-l border-ink/10 pl-5">
          {timeline.map((e) => (
            <li key={e.id}>
              <p className="text-sm text-ink">{e.title}</p>
              {e.detail ? <p className="text-xs text-ink-faint">{e.detail}</p> : null}
              <p className="mt-1 font-mono text-[10px] text-ink-faint">
                {e.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/portal/support" className="inline-block text-sm text-ink-mute underline-offset-4 hover:underline">
        Need help with this order?
      </Link>
    </div>
  );
}
