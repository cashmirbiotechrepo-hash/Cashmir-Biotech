import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export const metadata: Metadata = {
  title: "Customer Portal · Sign in",
  description: "Access your Cashmir Biotech orders, invoices, tracking, and certificates.",
  robots: { index: false, follow: false }
};

export default async function PortalLoginPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/portal");

  const params = await searchParams;
  const initialEmail = typeof params.email === "string" ? params.email : "";

  return (
    <div className="relative min-h-dvh bg-ivory">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgb(184 148 88 / 0.08), transparent 55%)"
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-5 sm:max-w-lg sm:px-6 sm:pt-8">
        <header>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center gap-2 text-[13px] text-ink-mute transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> Back to store
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center py-6 sm:py-10">
          <p className="text-[13px] font-medium tracking-wide text-gold">Cashmir Biotech</p>
          <h1 className="mt-2 text-[1.85rem] font-light leading-[1.1] tracking-tight text-ink sm:text-[2.15rem]">
            Welcome back.
          </h1>
          <p className="mt-3 max-w-[36ch] text-[14px] leading-relaxed text-ink-mute">
            Access orders, invoices, certificates and shipment tracking. Enter the email used at
            checkout.
          </p>

          <div className="mt-7 sm:mt-8">
            <Suspense
              fallback={
                <div className="h-48 animate-pulse border border-ink/10 bg-paper/50" aria-hidden />
              }
            >
              <PortalLoginForm initialEmail={initialEmail} />
            </Suspense>
          </div>

          <ul className="mt-8 space-y-2 text-[13px] text-ink-soft">
            <li className="flex gap-2">
              <span className="text-gold" aria-hidden>
                ✓
              </span>
              Track shipments
            </li>
            <li className="flex gap-2">
              <span className="text-gold" aria-hidden>
                ✓
              </span>
              Download GST invoices
            </li>
            <li className="flex gap-2">
              <span className="text-gold" aria-hidden>
                ✓
              </span>
              Certificates of Analysis
            </li>
          </ul>
        </main>

        <footer className="space-y-4 border-t border-ink/10 pt-6 text-[13px] text-ink-mute">
          <p>
            Purchased before? We&apos;ll find your account from your checkout email — nothing extra to
            set up.
          </p>
          <nav className="flex flex-col gap-1">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center text-ink-soft transition-colors hover:text-ink"
            >
              Contact support
            </Link>
            <Link
              href="/order/lookup"
              className="inline-flex min-h-11 items-center text-ink-soft transition-colors hover:text-ink"
            >
              Find an order
            </Link>
            <Link
              href="/tools"
              className="inline-flex min-h-11 items-center text-ink-soft transition-colors hover:text-ink"
            >
              Bioinformatics Suite
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
