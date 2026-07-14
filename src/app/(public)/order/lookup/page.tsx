import type { Metadata } from "next";
import Link from "next/link";
import { OrderLookupForm } from "@/components/shop/order-lookup-form";

export const metadata: Metadata = {
  title: "Find your order",
  description: "Look up a Cashmir Biotech order confirmation using your checkout email.",
  robots: { index: false, follow: false }
};

export default function OrderLookupPage() {
  return (
    <div className="frame py-16 md:py-24">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Guest lookup</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight text-ink">Find your order</h1>
        <p className="mt-3 text-sm text-ink-mute">
          Enter the email and order number from checkout. We will email a secure confirmation link — we never
          show order details on this page.
        </p>
      </div>
      <div className="mt-10">
        <OrderLookupForm />
      </div>
      <p className="mt-8 text-center text-sm text-ink-mute">
        Have a Customer Portal account?{" "}
        <Link href="/portal/login" className="text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
