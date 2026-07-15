"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { IntroProvider } from "@/components/experience/intro-context";
import { SmoothScroll } from "@/components/experience/smooth-scroll";
import { AmbientBackground } from "@/components/experience/ambient-background";
import { Grain } from "@/components/experience/grain";
import { Cursor } from "@/components/experience/cursor";
import { Loader } from "@/components/experience/loader";
import { SiteNav } from "@/components/experience/site-nav";
import { SiteFooter } from "@/components/experience/site-footer";
import { CheckoutFooter, CheckoutNav } from "@/components/shop/checkout-chrome";
import { CartProvider } from "@/components/shop/cart-context";
import { CustomerSessionKeepalive } from "@/components/portal/customer-session-keepalive";

const INTRO_KEY = "cb-intro-seen";

export type PublicShellCustomer = {
  name: string | null;
  email: string;
} | null;

/**
 * Persistent chrome for every public route. Nav, footer, ambient background and
 * smooth scroll live here so they survive client-side navigation (enabling real
 * page transitions). The cinematic loader only plays on the first home visit of
 * a session.
 */
export function PublicShell({
  children,
  customer = null
}: {
  children: React.ReactNode;
  customer?: PublicShellCustomer;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isCheckout = pathname === "/checkout" || pathname.startsWith("/checkout/");

  // Render the loader on the very first paint of a home load (SSR-safe) so the
  // hero never flashes before it. The effect then dismisses it immediately if
  // this session has already seen the intro.
  const [ready, setReady] = useState(!isHome);
  const [showLoader, setShowLoader] = useState(isHome);

  useEffect(() => {
    if (!isHome) {
      setReady(true);
      setShowLoader(false);
      return;
    }
    try {
      if (sessionStorage.getItem(INTRO_KEY)) {
        setShowLoader(false);
        setReady(true);
      }
    } catch {
      // Private mode / blocked storage — still allow the loader; it self-times out.
    }
    // Only evaluated on first mount; client nav to home should not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoaderComplete = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowLoader(false);
    setReady(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = showLoader ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showLoader]);

  return (
    <MotionConfig reducedMotion="user">
      <IntroProvider ready={ready}>
        <CartProvider>
        <CustomerSessionKeepalive enabled={Boolean(customer)} />
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[110] focus-visible:rounded-full focus-visible:bg-ink focus-visible:px-5 focus-visible:py-2.5 focus-visible:text-sm focus-visible:text-paper"
        >
          Skip to content
        </a>

        <AnimatePresence>
          {showLoader ? <Loader key="loader" onComplete={handleLoaderComplete} /> : null}
        </AnimatePresence>

        <Cursor />
        <Grain />
        {!isCheckout ? <AmbientBackground /> : null}
        {isCheckout ? <CheckoutNav /> : <SiteNav customer={customer} />}

        <SmoothScroll>
          <main id="main" className={isCheckout ? "relative flex min-h-[70vh] flex-col" : "relative"}>
            {children}
          </main>
          {isCheckout ? <CheckoutFooter /> : <SiteFooter customer={customer} />}
        </SmoothScroll>
        </CartProvider>
      </IntroProvider>
    </MotionConfig>
  );
}
