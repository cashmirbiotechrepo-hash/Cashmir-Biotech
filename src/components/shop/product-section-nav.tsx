"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCart } from "@/components/shop/cart-context";
import { useSmoothScroll } from "@/components/experience/smooth-scroll";
import { cn } from "@/lib/utils";

export type ProductNavSection = { id: string; label: string };

type Props = {
  sections: ProductNavSection[];
  priceLabel: string;
  available: number;
  product: {
    productId: string;
    slug: string;
    name: string;
    sizeLabel: string;
    priceInr: number;
    imageUrl: string;
  };
};

/** Header (4.5rem) + nav bar itself — used as the smooth-scroll offset. */
const SCROLL_OFFSET = -118;

/**
 * Sticky in-page nav: section tabs with an animated underline that tracks the
 * current section, plus a persistent price + Buy CTA. Tabs scroll smoothly
 * through Lenis and update the URL hash for deep linking.
 */
export function ProductSectionNav({ sections, priceLabel, available, product }: Props) {
  const { add } = useCart();
  const { lenis } = useSmoothScroll();
  const router = useRouter();
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);
  // While a click-scroll animates, don't let the observer flicker through
  // the sections it passes.
  const lockUntil = useRef(0);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!targets.length) return;

    // A section is current while its top sits in the upper third of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        if (performance.now() < lockUntil.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab in view when the list overflows on phones.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  function goTo(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    lockUntil.current = performance.now() + 1100;
    if (lenis) {
      lenis.scrollTo(el, { offset: SCROLL_OFFSET, duration: 1 });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.history.replaceState(null, "", `#${id}`);
  }

  const soldOut = available <= 0;

  function buyNow() {
    if (soldOut) return;
    add({ ...product, maxQty: Math.max(0, Math.min(available, 20)) }, 1);
    router.push("/checkout");
  }

  return (
    <nav
      aria-label="Product sections"
      className="sticky top-[4.5rem] z-30 border-b border-ink/8 bg-paper/95 backdrop-blur-md md:top-[4.75rem]"
    >
      <div className="frame flex items-center justify-between gap-3">
        <div
          ref={listRef}
          className="flex min-w-0 gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((section) => {
            const isActive = active === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                data-section={section.id}
                onClick={(e) => goTo(e, section.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative shrink-0 whitespace-nowrap px-2.5 py-3.5 text-[12px] transition-colors duration-300 sm:px-3",
                  isActive ? "font-medium text-ink" : "text-ink-mute hover:text-ink"
                )}
              >
                {section.label}
                {isActive ? (
                  <motion.span
                    layoutId="product-nav-underline"
                    transition={{ type: "spring", stiffness: 420, damping: 40 }}
                    className="absolute inset-x-2 bottom-0 h-[2px] bg-gold"
                  />
                ) : null}
              </a>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2.5 py-1.5 sm:gap-3">
          <span className="text-[13px] font-medium tracking-tight text-ink sm:text-[14px]">
            {priceLabel}
          </span>
          <button
            type="button"
            onClick={buyNow}
            disabled={soldOut}
            className="h-9 bg-ink px-4 text-[12px] font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
          >
            {soldOut ? "Sold out" : "Buy now"}
          </button>
        </div>
      </div>
    </nav>
  );
}
