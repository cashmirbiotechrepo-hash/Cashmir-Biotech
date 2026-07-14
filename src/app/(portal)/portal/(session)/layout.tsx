import { requireCustomerSession } from "@/lib/customer/auth";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function PortalSessionLayout({ children }: { children: React.ReactNode }) {
  const customer = await requireCustomerSession();
  return (
    <PortalShell customerEmail={customer.email} customerName={customer.name}>
      {children}
    </PortalShell>
  );
}
