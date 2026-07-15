import { PublicShell } from "@/components/experience/public-shell";
import { getCurrentCustomer } from "@/lib/customer/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCurrentCustomer().catch(() => null);

  return (
    <PublicShell
      customer={
        customer
          ? {
              name: customer.name ?? null,
              email: customer.email
            }
          : null
      }
    >
      {children}
    </PublicShell>
  );
}
