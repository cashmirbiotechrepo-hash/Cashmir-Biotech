import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireCustomerSession } from "@/lib/customer/auth";
import { getCustomerSecurityProfile } from "@/lib/customer/portal";
import { getPortalMembershipFlags } from "@/lib/customer/portal-extras";
import { listClaimableAddressSnapshots } from "@/lib/customer/address-claim";
import { db } from "@/lib/db";
import { PortalProfileForm } from "@/components/portal/portal-profile-form";
import { NotificationPrefsForm } from "@/components/portal/notification-prefs-form";
import { AddressClaimBanner } from "@/components/portal/address-claim-banner";
import { logoutPortalAction } from "../actions";

export const metadata: Metadata = {
  title: "Account · Customer Portal",
  robots: { index: false, follow: false }
};

export default async function PortalAccountPage() {
  const session = await requireCustomerSession();
  const [profile, flags, claimable, prefs] = await Promise.all([
    getCustomerSecurityProfile(session.id),
    getPortalMembershipFlags(session.id),
    listClaimableAddressSnapshots(session.id),
    db.customer.findUnique({
      where: { id: session.id },
      select: { notifyOrderUpdates: true, notifyMarketing: true }
    })
  ]);
  if (!profile) return null;

  const links = [
    { href: "/portal/addresses", label: "Addresses", detail: "Shipping book" },
    { href: "/portal/wishlist", label: "Wishlist", detail: "Saved products" },
    { href: "/portal/documents", label: "Invoices", detail: "Tax invoices & PDFs" },
    { href: "/portal/security", label: "Security", detail: "Devices & sessions" },
    ...(flags.hasOrg
      ? [{ href: "/portal/organization", label: "Organisation", detail: "Lab seats & invites" }]
      : []),
    ...(flags.hasCircle
      ? [{ href: "/portal/circle", label: "Research Circle", detail: "Membership & plans" }]
      : [])
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Account</p>
        <h1 className="mt-2 text-[1.65rem] font-light tracking-tight text-ink md:text-3xl">Your details</h1>
        <p className="mt-1 text-[13px] text-ink-mute">
          Name and phone used at checkout. Email is your sign-in identity.
        </p>
      </header>

      <AddressClaimBanner count={claimable.length} />

      <section className="space-y-4 border border-ink/10 bg-paper p-4 sm:p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Email</p>
          <p className="mt-1 text-sm text-ink">{profile.email}</p>
          <p className="mt-1 text-xs text-ink-mute">
            {profile.emailVerifiedAt
              ? `Verified ${profile.emailVerifiedAt.toLocaleDateString("en-IN")}`
              : "Verify via OTP when prompted"}
          </p>
        </div>
        <PortalProfileForm name={profile.name} phone={profile.phone} />
      </section>

      <NotificationPrefsForm
        notifyOrderUpdates={prefs?.notifyOrderUpdates ?? true}
        notifyMarketing={prefs?.notifyMarketing ?? false}
      />

      <nav className="divide-y divide-ink/8 border border-ink/10 bg-paper">
        {links.map((item) => (
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

      <form action={logoutPortalAction}>
        <button
          type="submit"
          className="text-[13px] font-medium text-ink-mute underline-offset-4 hover:text-ink hover:underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
