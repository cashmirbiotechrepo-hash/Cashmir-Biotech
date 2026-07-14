import { db } from "@/lib/db";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FinancePanel } from "@/components/admin/finance-panel";
import { buttonVariants } from "@/components/ui/button";
import { listExpenses, listInvoices } from "@/modules/admin/services/phase2.service";

export const metadata = { title: "Finance" };

export default async function AdminFinancePage() {
  const [invoices, expenses, billableOrders] = await Promise.all([
    listInvoices(),
    listExpenses(),
    db.order.findMany({
      where: { status: { in: ["paid", "processing", "shipped", "delivered"] } },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  return (
    <>
      <AdminPageHeader
        title="Finance"
        description="GST invoices from orders and an expense log for lab, ops, and vendor spend."
        actions={
          <Link href="/api/admin/finance/export" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Export CSV
          </Link>
        }
      />
      <FinancePanel invoices={invoices} expenses={expenses} billableOrders={billableOrders} />
    </>
  );
}
