"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/shop/cart-context";
import { ThemeToggle } from "@/components/experience/theme-toggle";
import { SITE_CONTACT } from "@/lib/site-contact";

/** Focused chrome for checkout — logo, bag, help. No browse exits. */
export function CheckoutNav() {
  const { count, ready } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/95 backdrop-blur-md">
      <div className="frame flex h-14 items-center justify-between md:h-[3.75rem]">
        <Link href="/" className="flex items-center" aria-label="Cashmir Biotech home">
          <span className="logo-plate">
            <Image
              src="/logo.png"
              alt="Cashmir Biotech"
              width={180}
              height={48}
              className="h-9 w-auto md:h-10"
              priority
            />
          </span>
        </Link>
        <div className="flex items-center gap-4 md:gap-6">
          <ThemeToggle />
          <a
            href={`mailto:${SITE_CONTACT.supportEmail}`}
            className="text-[13px] text-ink-mute transition-colors hover:text-ink"
          >
            Help
          </a>
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 rounded-sm border border-ink/12 bg-pearl/60 px-2.5 py-1.5 text-[13px] text-ink transition-colors hover:border-ink/25 hover:bg-pearl"
            aria-label={ready && count > 0 ? `Formula, ${count} items` : "Formula"}
          >
            <ShoppingBag className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span>
              Formula
              {ready && count > 0 ? (
                <span className="ml-1.5 tabular-nums text-gold">{count}</span>
              ) : null}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function CheckoutFooter() {
  return (
    <footer className="mt-auto border-t border-ink/10 bg-paper py-5">
      <div className="frame flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-[12px] text-ink-mute">Secure research checkout · Razorpay</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink-mute">
          <a href={`mailto:${SITE_CONTACT.supportEmail}`} className="hover:text-ink">
            Support
          </a>
          <Link href="/contact" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/contact" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-ink">
            Returns
          </Link>
        </nav>
      </div>
    </footer>
  );
}
