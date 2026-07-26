import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";
import {
  DocFooter,
  DocHeader,
  DocLabel,
  DocShell,
  MarkCircle
} from "@/components/admin/order-print-doc";
import { batchLabelForOrder } from "@/modules/shop/services/order-ops.service";

export const metadata = { title: "Packing slip" };

type Addr = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  fullName?: string;
};

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!order) notFound();
  const addr = (order.shippingAddress ?? {}) as Addr;
  const batch = batchLabelForOrder(order.orderNumber, order.createdAt);
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <DocShell
      toolbar={
        <>
          <PrintButton />
          <Link href={`/admin/orders/${order.id}`} className="text-sm underline">
            ← Order
          </Link>
        </>
      }
    >
      <DocHeader
        title="PACKING SLIP"
        number={order.orderNumber}
        meta={[
          `Placed ${order.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
          "Warehouse copy · Prices excluded"
        ]}
      />

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <DocLabel>Ship to</DocLabel>
          <div className="mt-2 space-y-0.5 text-[10px] leading-snug">
            {addressLines({ ...addr, fullName: order.customerName ?? addr.fullName }).map((l) => (
              <div
                key={l}
                className={
                  l === (order.customerName ?? addr.fullName) ? "font-medium text-ink" : "text-ink-mute"
                }
              >
                {l}
              </div>
            ))}
          </div>
        </div>
        <div>
          <DocLabel>Fulfilment</DocLabel>
          <dl className="mt-2 space-y-1.5 text-[10px]">
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-ink-mute">Lot</dt>
              <dd className="tabular-nums text-ink">{batch}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-ink-mute">Packed by</dt>
              <dd className="border-b border-ink/30 min-w-[8rem]">&nbsp;</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-ink-mute">Checked by</dt>
              <dd className="border-b border-ink/30 min-w-[8rem]">&nbsp;</dd>
            </div>
          </dl>
        </div>
      </div>

      <table className="mt-10 w-full table-fixed text-[10px]">
        <colgroup>
          <col className="w-[6%]" />
          <col className="w-[56%]" />
          <col className="w-[28%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-ink text-left text-[8px] font-semibold uppercase tracking-[0.08em] text-ink-mute">
            <th className="py-2">Mark</th>
            <th className="py-2">Product</th>
            <th className="py-2">Lot</th>
            <th className="py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/10">
              <td className="py-3 align-middle">
                <MarkCircle />
              </td>
              <td className="py-3 align-middle font-medium">{item.productName}</td>
              <td className="py-3 align-middle whitespace-nowrap tabular-nums text-ink">{batch}</td>
              <td className="py-3 align-middle text-right text-[11px] font-medium tabular-nums">
                {item.quantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-[10px] font-semibold text-ink">Total units to pack: {units}</p>

      <div className="mt-8 border-t border-ink/20 pt-4">
        <DocLabel>Packing instructions</DocLabel>
        <p className="mt-2 text-[9.5px] text-ink-mute">
          Include the usage guide and invoice copy when requested. This warehouse copy must not be
          inserted into the customer&apos;s parcel.
        </p>
      </div>

      <DocFooter docLabel={`Packing slip ${order.orderNumber}`} />
    </DocShell>
  );
}
