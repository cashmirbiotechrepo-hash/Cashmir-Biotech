import { requireCustomerSession } from "@/lib/customer/auth";
import { getPortalMembershipFlags } from "@/lib/customer/portal-extras";
import { PortalShell } from "@/components/portal/portal-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function PortalSessionLayout({ children }: { children: React.ReactNode }) {
  const customer = await requireCustomerSession();
  const flags = await getPortalMembershipFlags(customer.id);
  return (
    <PortalShell
      customerEmail={customer.email}
      customerName={customer.name}
      hasOrg={flags.hasOrg}
      hasCircle={flags.hasCircle}
    >
      {children}
      <Toaster richColors position="top-center" />
    </PortalShell>
  );
}
