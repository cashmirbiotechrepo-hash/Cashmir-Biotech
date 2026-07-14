import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";
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
    include: {
      items: { include: { product: { select: { sku: true } } } }
    }
  });
  if (!order) notFound();
  const addr = (order.shippingAddress ?? {}) as Addr;
  const batch = batchLabelForOrder(order.orderNumber, order.createdAt);

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-ink print:max-w-none print:p-0">
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <PrintButton />
        <Link href={`/admin/orders/${order.id}`} className="text-sm underline">
          ← Order
        </Link>
      </div>

      <div className="flex items-start justify-between border-b border-ink/15 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">Warehouse</p>
          <h1 className="mt-1 text-2xl font-light">Packing slip</h1>
          <p className="mt-1 font-mono text-sm">{order.orderNumber}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">NO PRICES</p>
          <p className="text-ink-mute">Pick · Pack · QC</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Ship to</p>
          <div className="mt-2 space-y-0.5 text-sm">
            {addressLines({ ...addr, fullName: order.customerName ?? addr.fullName }).map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-mute">Batch / lot</span>
            <span className="font-mono">{batch}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-mute">QC</span>
            <span>Pass before seal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-mute">Packed by</span>
            <span className="border-b border-ink/30 px-8">&nbsp;</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-mute">Checked by</span>
            <span className="border-b border-ink/30 px-8">&nbsp;</span>
          </div>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-ink/15 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            <th className="py-2">☐</th>
            <th className="py-2">SKU</th>
            <th className="py-2">Product</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2">Lot</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/8">
              <td className="py-3">☐</td>
              <td className="py-3 font-mono text-xs">{item.product?.sku || "—"}</td>
              <td className="py-3 font-medium">{item.productName}</td>
              <td className="py-3 text-right tabular-nums text-lg font-medium">{item.quantity}</td>
              <td className="py-3 font-mono text-xs">{batch}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-10 text-xs text-ink-mute">
        Include usage guide PDF and GST invoice copy in carton when requested. Do not print prices on this
        slip.
      </p>
    </div>
  );
}
