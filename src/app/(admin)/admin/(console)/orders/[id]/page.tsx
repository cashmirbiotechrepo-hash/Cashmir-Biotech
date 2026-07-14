import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OrderWorkspace } from "@/components/admin/order-workspace";
import {
  batchLabelForOrder,
  buildOrderTimeline,
  ensureInvoiceForOrder,
  getCustomerOrderStats
} from "@/modules/shop/services/order-ops.service";

export const metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { sku: true, slug: true } } } },
      invoices: { orderBy: { issuedAt: "desc" } },
      paymentEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!order) notFound();

  if (
    ["paid", "processing", "shipped", "delivered"].includes(order.status) &&
    order.invoices.length === 0
  ) {
    await ensureInvoiceForOrder(order.id).catch(() => undefined);
  }

  const fresh = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { sku: true, slug: true } } } },
      invoices: { orderBy: { issuedAt: "desc" } },
      paymentEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!fresh) notFound();

  const timeline = buildOrderTimeline(fresh);
  const batch = batchLabelForOrder(fresh.orderNumber, fresh.createdAt);
  const customerStats = await getCustomerOrderStats(fresh.customerEmail);

  return (
    <OrderWorkspace
      order={{
        id: fresh.id,
        orderNumber: fresh.orderNumber,
        status: fresh.status,
        createdAt: fresh.createdAt,
        updatedAt: fresh.updatedAt,
        customerName: fresh.customerName,
        customerEmail: fresh.customerEmail,
        customerPhone: fresh.customerPhone,
        shippingAddress: fresh.shippingAddress,
        subtotalCents: fresh.subtotalCents,
        taxCents: fresh.taxCents,
        shippingCents: fresh.shippingCents,
        totalCents: fresh.totalCents,
        refundedCents: fresh.refundedCents,
        razorpayPaymentId: fresh.razorpayPaymentId,
        razorpayOrderId: fresh.razorpayOrderId,
        stockDeducted: fresh.stockDeducted,
        stockReserved: fresh.stockReserved,
        trackingNumber: fresh.trackingNumber,
        carrier: fresh.carrier,
        adminNotes: fresh.adminNotes,
        shippedAt: fresh.shippedAt,
        items: fresh.items,
        invoices: fresh.invoices.map((inv) => ({ id: inv.id, invoiceNumber: inv.invoiceNumber })),
        paymentEvents: fresh.paymentEvents.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          signatureValid: e.signatureValid,
          createdAt: e.createdAt
        }))
      }}
      batch={batch}
      timeline={timeline}
      customerStats={customerStats}
    />
  );
}
