import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";
import {
  DocFooter,
  DocHeader,
  DocLabel,
  DocMetaRow,
  DocShell,
  DocTableHead,
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

      <div className="mt-8 grid grid-cols-2 gap-10">
        <div>
          <DocLabel>Ship to</DocLabel>
          <div className="mt-2 space-y-0.5 text-[10pt] leading-snug">
            {addressLines({ ...addr, fullName: order.customerName ?? addr.fullName }).map((l, i) => (
              <p key={l} className={i === 0 ? "font-semibold text-[#141416]" : "text-[#5c5c60]"}>
                {l}
              </p>
            ))}
          </div>
        </div>
        <div>
          <DocLabel>Fulfilment</DocLabel>
          <dl className="mt-2 space-y-2">
            <DocMetaRow label="Lot" value={batch} strong />
            <DocMetaRow
              label="Courier"
              value={order.carrier || "________________"}
            />
            <DocMetaRow
              label="Tracking"
              value={order.trackingNumber || "________________"}
            />
            <DocMetaRow label="Packed by" value="________________" />
          </dl>
        </div>
      </div>

      <table className="mt-9 w-full table-fixed text-[9.5pt]">
        <colgroup>
          <col className="w-[8%]" />
          <col className="w-[54%]" />
          <col className="w-[26%]" />
          <col className="w-[12%]" />
        </colgroup>
        <DocTableHead>
          <th className="px-2 py-2">Mark</th>
          <th className="px-2 py-2">Product</th>
          <th className="px-2 py-2">Lot</th>
          <th className="px-2 py-2 text-right">Qty</th>
        </DocTableHead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-[#e6e6e8]">
              <td className="px-2 py-3.5 align-middle">
                <MarkCircle />
              </td>
              <td className="px-2 py-3.5 align-middle font-medium">{item.productName}</td>
              <td className="px-2 py-3.5 align-middle whitespace-nowrap tabular-nums">{batch}</td>
              <td className="px-2 py-3.5 align-middle text-right text-[11pt] font-semibold tabular-nums">
                {item.quantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[10pt] font-semibold text-[#141416]">Total units to pack: {units}</p>

      <div className="mt-9 border-t border-[#d4d4d6] pt-4">
        <DocLabel>Packing instructions</DocLabel>
        <p className="mt-2 max-w-[140mm] text-[9pt] leading-relaxed text-[#5c5c60]">
          Include the usage guide and invoice copy when requested. This warehouse copy must not be
          inserted into the customer&apos;s parcel.
        </p>
      </div>

      <div className="mt-10">
        <DocFooter docLabel={`Packing slip ${order.orderNumber}`} />
      </div>
    </DocShell>
  );
}
