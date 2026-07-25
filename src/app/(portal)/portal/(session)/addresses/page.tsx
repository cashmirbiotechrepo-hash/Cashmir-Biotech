import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerAddresses } from "@/lib/customer/portal";
import { deletePortalAddress, setDefaultPortalAddress } from "../actions";
import { PortalAddressesClient } from "@/components/portal/portal-addresses-client";

export const metadata: Metadata = {
  title: "Addresses · Customer Portal",
  robots: { index: false, follow: false }
};

export default async function PortalAddressesPage() {
  const session = await requireCustomerSession();
  const addresses = await getCustomerAddresses(session.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-[13px] text-ink-mute">
          <Link href="/portal/account" className="hover:text-ink hover:underline">
            Account
          </Link>
          <span className="mx-1.5 text-ink-faint">/</span>
          Addresses
        </p>
        <h1 className="mt-1 text-[1.65rem] font-light tracking-tight text-ink">Shipping addresses</h1>
        <p className="mt-1 text-[13px] text-ink-mute">Saved for faster checkout. Edit anytime.</p>
      </header>

      <PortalAddressesClient
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country,
          isDefault: a.isDefault
        }))}
        deleteAction={deletePortalAddress}
        setDefaultAction={setDefaultPortalAddress}
      />
    </div>
  );
}
