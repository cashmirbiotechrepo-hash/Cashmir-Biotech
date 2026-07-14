import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Package, ShieldCheck, Truck } from "lucide-react";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export const metadata: Metadata = {
  title: "Customer Portal · Sign in",
  description: "Access your Cashmir Biotech orders, invoices, tracking, and certificates.",
  robots: { index: false, follow: false }
};

const BENEFITS = [
  { icon: Package, title: "Orders", detail: "Track every shipment and reorder formulations." },
  { icon: FileText, title: "Invoices & CoAs", detail: "Download GST invoices and lot certificates." },
  { icon: Truck, title: "Tracking", detail: "Courier updates and delivery progress." },
  { icon: ShieldCheck, title: "Account", detail: "Addresses, organisation seats, and support." }
] as const;

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
    <div className="relative min-h-screen overflow-hidden bg-ivory">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 12% 20%, rgb(184 148 88 / 0.09), transparent 45%), radial-gradient(ellipse at 90% 10%, rgb(244 244 242 / 0.9), transparent 40%)"
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 md:px-8 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> Back to store
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Customer Portal</p>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.85fr)] lg:gap-16 lg:py-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Cashmir Biotech</p>
            <h1 className="mt-3 max-w-[12ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-light leading-[1.02] tracking-tight text-ink">
              Welcome back.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-mute">
              Access your orders, invoices, tracking, downloads, and research purchases. Enter the email used
              at checkout — we&apos;ll send a secure one-time login code.
            </p>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-3 border-t border-ink/10 pt-4">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} aria-hidden />
                  <div>
                    <p className="text-[14px] font-medium text-ink">{title}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-ink-mute">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-12 border-t border-ink/10 pt-8" aria-hidden>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">Inside your account</p>
              <svg
                className="mt-5 w-full max-w-md text-ink/35"
                viewBox="0 0 420 72"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="18" width="44" height="34" rx="2" />
                  <path d="M16 28h28M16 36h18" />
                  <path d="M62 35h28" />
                  <rect x="100" y="14" width="36" height="44" rx="2" />
                  <path d="M108 26h20M108 34h20M108 42h12" />
                  <path d="M146 35h28" />
                  <circle cx="198" cy="35" r="18" />
                  <path d="M190 35h16M198 27v16" />
                  <path d="M226 35h28" />
                  <path d="M264 18h40v36h-40z" />
                  <path d="M272 28h24M272 36h24M272 44h14" />
                </g>
                <text x="30" y="68" textAnchor="middle" className="fill-ink-faint" style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}>
                  Order
                </text>
                <text x="118" y="68" textAnchor="middle" className="fill-ink-faint" style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}>
                  Invoice
                </text>
                <text x="198" y="68" textAnchor="middle" className="fill-ink-faint" style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}>
                  Tracking
                </text>
                <text x="284" y="68" textAnchor="middle" className="fill-ink-faint" style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}>
                  CoA
                </text>
              </svg>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {["Orders", "GST invoices", "Tracking", "Certificates", "Addresses", "Support"].map((label) => (
                  <div
                    key={label}
                    className="border border-ink/10 bg-paper/60 px-3 py-3 text-[12px] text-ink-soft"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-10 text-[12px] text-ink-faint">
              Looking for BLAST and sequence tools?{" "}
              <Link href="/tools" className="text-ink-mute underline-offset-4 hover:text-ink hover:underline">
                Open the Bioinformatics Suite
              </Link>
              . Need bulk quotes or institutional purchasing?{" "}
              <Link href="/contact" className="text-ink-mute underline-offset-4 hover:text-ink hover:underline">
                Contact us
              </Link>
              .
            </p>
          </div>

          <div className="lg:justify-self-end lg:w-full">
            <Suspense fallback={<p className="text-sm text-ink-mute">Loading…</p>}>
              <PortalLoginForm initialEmail={initialEmail} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
