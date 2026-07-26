import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Invoice" };

/**
 * Legacy finance invoice URL — send operators to the printable order invoice.
 * Keeps old bookmarks working without the sparse finance detail view.
 */
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    select: { id: true, orderId: true, invoiceNumber: true }
  });
  if (!invoice) notFound();

  if (invoice.orderId) {
    redirect(`/admin/orders/${invoice.orderId}/print/invoice`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Invoice <span className="font-medium text-foreground">{invoice.invoiceNumber}</span> has no
        linked order, so the printable tax invoice is unavailable.
      </p>
      <div className="flex items-center gap-3">
        <PrintButton />
        <Link href="/admin/finance" className="text-sm underline">
          ← Finance
        </Link>
      </div>
    </div>
  );
}
