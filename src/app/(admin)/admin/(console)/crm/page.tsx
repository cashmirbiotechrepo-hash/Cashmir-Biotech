import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CrmPanel } from "@/components/admin/crm-panel";
import { KpiCard } from "@/components/admin/kpi-card";
import { buttonVariants } from "@/components/ui/button";
import { getCrmSummary, listContacts, listDeals } from "@/modules/admin/services/phase2.service";
import { Handshake, TrendingUp, Users } from "lucide-react";

export const metadata = { title: "CRM" };

export default async function AdminCrmPage() {
  const [summary, contacts, deals] = await Promise.all([getCrmSummary(), listContacts(), listDeals()]);

  return (
    <>
      <AdminPageHeader
        title="CRM"
        description="Contacts and a lightweight deal pipeline — not a Salesforce clone, just what you need to track institutional leads."
        actions={
          <Link href="/api/admin/contacts/export" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Export contacts
          </Link>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Contacts" value={summary.contacts} icon={Users} />
        <KpiCard label="Open deals" value={summary.openDeals} icon={Handshake} />
        <KpiCard
          label="Pipeline value"
          value={`₹${summary.pipelineValueInr.toLocaleString("en-IN")}`}
          icon={TrendingUp}
        />
      </div>
      <CrmPanel contacts={contacts} deals={deals} />
    </>
  );
}
