import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";

export const metadata = { title: "Shipping label" };

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

export default async function ShippingLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();
  const addr = (order.shippingAddress ?? {}) as Addr;
  const units = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="mx-auto max-w-md bg-white p-6 text-ink print:max-w-none print:p-0">
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <PrintButton />
        <Link href={`/admin/orders/${order.id}`} className="text-sm underline">
          ← Order
        </Link>
      </div>

      <div className="border-2 border-ink p-5">
        <div className="flex items-start justify-between gap-3 border-b border-ink pb-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em]">From</p>
            <p className="mt-1 text-sm font-medium">Cashmir Biotech Pvt Ltd</p>
            <p className="text-xs text-ink-mute">Kashmir, India</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs">{order.orderNumber}</p>
            <p className="mt-1 text-[10px] uppercase text-ink-mute">{units} unit(s)</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em]">Ship to</p>
          <div className="mt-2 space-y-0.5 text-base leading-snug">
            {addressLines({ ...addr, fullName: order.customerName ?? addr.fullName }).map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink pt-4 text-sm">
          <div>
            <p className="text-[10px] uppercase text-ink-mute">Courier</p>
            <p className="mt-0.5 font-medium">{order.carrier || "________________"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-ink-mute">AWB / Tracking</p>
            <p className="mt-0.5 break-all font-mono text-xs font-medium">
              {order.trackingNumber || "________________"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-ink-mute">Service</p>
            <p className="mt-0.5">Standard · Prepaid</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-ink-mute">COD</p>
            <p className="mt-0.5">No</p>
          </div>
        </div>

        <div className="mt-5 border border-dashed border-ink/40 p-3 text-center">
          <p className="font-mono text-lg tracking-widest">{order.orderNumber}</p>
          <p className="mt-1 text-[10px] text-ink-mute">
            Barcode placeholder — scan order # in warehouse mode
          </p>
        </div>
      </div>
    </div>
  );
}
