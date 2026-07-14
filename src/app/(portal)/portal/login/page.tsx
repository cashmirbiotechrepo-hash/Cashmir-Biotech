import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export const metadata: Metadata = {
  title: "Research Portal",
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-ivory via-paper to-sky/20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgb(184 148 88 / 0.12), transparent 42%), radial-gradient(circle at 80% 0%, rgb(169 201 222 / 0.25), transparent 40%)"
        }}
      />
      <div className="relative flex min-h-screen flex-col px-5 py-10 md:px-8">
        <Link href="/" className="mb-12 inline-flex font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint hover:text-ink">
          ← Cashmir Biotech
        </Link>
        <div className="flex flex-1 items-center justify-center pb-16">
          <Suspense fallback={<p className="text-sm text-ink-mute">Loading…</p>}>
            <PortalLoginForm initialEmail={initialEmail} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
