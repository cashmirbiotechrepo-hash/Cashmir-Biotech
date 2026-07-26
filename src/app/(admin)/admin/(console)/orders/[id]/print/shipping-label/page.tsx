import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";
import { addressLines } from "@/components/admin/order-print-shell";
import { DocLabel } from "@/components/admin/order-print-doc";
import { SITE_CONTACT } from "@/lib/site-contact";

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
  const shipLines = addressLines({
    ...addr,
    fullName: order.customerName ?? addr.fullName
  });

  return (
    <div className="font-sans text-[#141416] antialiased print:bg-white">
      <div className="mx-auto mb-5 flex max-w-[110mm] items-center gap-3 px-4 print:hidden">
        <PrintButton />
        <Link href={`/admin/orders/${order.id}`} className="text-sm underline">
          ← Order
        </Link>
      </div>

      <article className="mx-auto w-full max-w-[110mm] border-[1.5pt] border-[#141416] bg-white print:max-w-none">
        <div className="flex items-start justify-between gap-3 border-b-[1.25pt] border-[#141416] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={24}
              className="mt-0.5 h-6 w-auto object-contain"
              unoptimized
            />
            <div>
              <p className="text-[11pt] font-semibold leading-none">Cashmir Biotech</p>
              <p className="mt-1 text-[7pt] leading-snug text-[#5c5c60]">
                {SITE_CONTACT.company}
                <br />
                {SITE_CONTACT.location}
              </p>
            </div>
          </div>
          <div className="text-right">
            <DocLabel>Order</DocLabel>
            <p className="mt-1 text-[9pt] font-semibold tabular-nums">{order.orderNumber}</p>
            <p className="mt-1 text-[7.5pt] text-[#5c5c60]">{units} unit{units === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="border-b border-[#d4d4d6] px-4 py-4">
          <DocLabel>Ship to</DocLabel>
          <div className="mt-2 space-y-0.5 text-[12pt] leading-snug">
            {shipLines.map((l, i) => (
              <p key={l} className={i === 0 ? "font-semibold" : "text-[10pt] text-[#2a2a2e]"}>
                {l}
              </p>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[#d4d4d6] px-4 py-3 text-[9pt]">
          <div>
            <DocLabel>Courier</DocLabel>
            <p className="mt-1 font-medium">{order.carrier || "________________"}</p>
          </div>
          <div>
            <DocLabel>AWB / Tracking</DocLabel>
            <p className="mt-1 break-all font-medium tabular-nums">
              {order.trackingNumber || "________________"}
            </p>
          </div>
          <div>
            <DocLabel>Service</DocLabel>
            <p className="mt-1">Standard · Prepaid</p>
          </div>
          <div>
            <DocLabel>COD</DocLabel>
            <p className="mt-1">No</p>
          </div>
        </div>

        <div className="px-4 py-4 text-center">
          <p className="text-[13pt] font-semibold tabular-nums tracking-wide">{order.orderNumber}</p>
          <p className="mt-1.5 text-[7.5pt] text-[#6b6b70]">Warehouse scan reference</p>
        </div>
      </article>
    </div>
  );
}
