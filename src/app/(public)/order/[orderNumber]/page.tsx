import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { getOrderSummaryByNumber } from "@/modules/shop/services/order.service";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false }
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function redactEmail(email: string | null | undefined) {
  if (!email) return "your email";
  const [user, domain] = email.split("@");
  if (!user || !domain) return "your email";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}

export default async function OrderConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNumber } = await params;
  const { t: token } = await searchParams;
  if (!token) notFound();

  const order = await getOrderSummaryByNumber(orderNumber, token);
  if (!order) notFound();

  const paid =
    order.status === "paid" ||
    order.status === "processing" ||
    order.status === "shipped" ||
    order.status === "delivered";

  return (
    <div className="pb-8">
      <PageHeader eyebrow="Thank you" title="Order received." accentWords={[1]} />
      <section className="frame">
        <Reveal>
          <div className="mx-auto max-w-2xl rounded-2xl border border-ink/10 bg-paper/70 p-8 shadow-glass md:p-10">
            <div className="flex items-center gap-3">
              {paid ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              ) : (
                <Clock className="h-7 w-7 text-gold" />
              )}
              <div>
                <p className="text-lg font-light text-ink">
                  {paid ? "Payment confirmed" : "Awaiting payment confirmation"}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                  Order {order.orderNumber}
                </p>
              </div>
            </div>

            {!paid ? (
              <p className="mt-5 rounded-lg bg-gold/10 px-4 py-3 text-sm text-ink-mute">
                We&apos;re confirming your payment with the bank. This usually takes a moment — you&apos;ll get a
                confirmation email once it clears.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-ink-mute">
                  A confirmation has been sent to {redactEmail(order.customerEmail)}. We&apos;ll email you again when
                  it ships.
                </p>
                {order.customerEmail ? (
                  <div className="rounded-xl border border-ink/10 bg-ivory/80 px-5 py-4">
                    <p className="text-sm font-medium text-ink">Your Customer Portal is ready</p>
                    <p className="mt-1 text-sm text-ink-mute">
                      Track this order, download invoices, and revisit every formulation tied to this email — even past
                      guest checkouts once you verify with a one-time code.
                    </p>
                    <Link
                      href="/portal/login"
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-paper"
                    >
                      Continue to Customer Portal →
                    </Link>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-4">
                  <a
                    href={`/api/order/${order.orderNumber}/invoice.pdf?t=${order.confirmationToken}`}
                    className="inline-flex text-sm text-ink underline-offset-4 hover:underline"
                  >
                    Download tax invoice (PDF)
                  </a>
                  <a
                    href={`/api/order/${order.orderNumber}/packing.pdf?t=${order.confirmationToken}`}
                    className="inline-flex text-sm text-ink underline-offset-4 hover:underline"
                  >
                    Packing slip (PDF)
                  </a>
                  <Link
                    href={`/order/${order.orderNumber}/invoice?t=${order.confirmationToken}`}
                    className="inline-flex text-sm text-ink-mute underline-offset-4 hover:underline"
                  >
                    Printable invoice
                  </Link>
                </div>
              </div>
            )}

            <ul className="mt-8 space-y-3 border-t border-ink/10 pt-6">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3 text-sm">
                  <span className="text-ink-mute">
                    {i.quantity} × {i.productName}
                  </span>
                  <span className="text-ink">{inr.format((i.unitPriceCents * i.quantity) / 100)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-mute">Subtotal</dt>
                <dd className="text-ink">{inr.format(order.subtotalCents / 100)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-mute">Shipping</dt>
                <dd className="text-ink">
                  {order.shippingCents === 0 ? "Free" : inr.format(order.shippingCents / 100)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-2 text-base">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-medium text-ink">{inr.format(order.totalCents / 100)}</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              {paid && order.customerEmail ? (
                <Link
                  href={`/portal/login?email=${encodeURIComponent(order.customerEmail)}`}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[13px] font-medium text-paper"
                >
                  Open Customer Portal
                </Link>
              ) : null}
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-7 py-3.5 text-[13px] font-medium text-ink"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
