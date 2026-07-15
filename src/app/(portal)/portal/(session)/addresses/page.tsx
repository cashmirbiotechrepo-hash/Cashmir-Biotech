import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerAddresses } from "@/lib/customer/portal";
import { deletePortalAddress, setDefaultPortalAddress } from "../actions";
import { PortalAddressForm } from "@/components/portal/portal-address-form";

export const metadata: Metadata = {
  title: "Account · Customer Portal",
  robots: { index: false, follow: false }
};

const ACCOUNT_LINKS = [
  { href: "/portal/organization", label: "Organisation", detail: "Lab seats & invites" },
  { href: "/portal/circle", label: "Research Circle", detail: "Membership & plans" },
  { href: "/portal/security", label: "Security", detail: "Sessions & sign-in" }
] as const;

export default async function PortalAddressesPage() {
  const session = await requireCustomerSession();
  const addresses = await getCustomerAddresses(session.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-[1.65rem] font-light tracking-tight text-ink">Account</h1>
        <p className="mt-1 text-[13px] text-ink-mute">Addresses, organisation, and security.</p>
      </header>

      <nav className="divide-y divide-ink/8 border border-ink/10 bg-paper">
        {ACCOUNT_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-12 items-center gap-3 px-3 py-3 active:bg-pearl"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{item.label}</p>
              <p className="text-[12px] text-ink-mute">{item.detail}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-faint" aria-hidden />
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-ink-mute">Shipping addresses</h2>
        {addresses.length === 0 ? (
          <p className="mb-4 text-[13px] text-ink-mute">No saved addresses yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {addresses.map((a) => (
              <li key={a.id} className="border border-ink/10 bg-paper p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium text-ink">
                      {a.label}
                      {a.isDefault ? (
                        <span className="ml-2 text-[11px] font-medium text-gold">Default</span>
                      ) : null}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">
                      {a.fullName}
                      <br />
                      {a.line1}
                      {a.line2 ? (
                        <>
                          <br />
                          {a.line2}
                        </>
                      ) : null}
                      <br />
                      {a.city}, {a.state} {a.postalCode}
                      <br />
                      {a.phone}
                    </p>
                  </div>
                  <div className="flex gap-3 text-[13px]">
                    {!a.isDefault ? (
                      <form action={setDefaultPortalAddress.bind(null, a.id)}>
                        <button type="submit" className="text-ink-mute hover:text-ink">
                          Set default
                        </button>
                      </form>
                    ) : null}
                    <form action={deletePortalAddress.bind(null, a.id)}>
                      <button type="submit" className="text-red-700/80 hover:text-red-700">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 text-[13px] font-medium text-ink-mute">Add address</h3>
        <PortalAddressForm />
      </section>
    </div>
  );
}
