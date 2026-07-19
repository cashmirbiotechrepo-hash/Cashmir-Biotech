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
  const navRef = useRef<HTMLElement>(null);
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

  // Keep the active tab visible in the horizontal strip — never scroll the PAGE
  // (Element.scrollIntoView on a sticky child fights Lenis and jumps to the header).
  useEffect(() => {
    const container = listRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!container || !el) return;
    const left = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  function stickyOffset(): number {
    const productNavH = navRef.current?.offsetHeight ?? 52;
    // Site nav is a fixed floating pill (~4.5rem). Leave a little air below the
    // product tab bar so the section heading isn't hidden under chrome.
    const siteNavH = 72;
    return -(siteNavH + productNavH + 12);
  }

  function revealSection(el: HTMLElement) {
    // Wake Framer whileInView observers that Lenis jump-scrolls can miss.
    el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((node) => {
      node.dispatchEvent(new Event("cb:reveal"));
    });
  }

  function goTo(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    lockUntil.current = performance.now() + 1200;
    const offset = stickyOffset();

    if (lenis) {
      lenis.scrollTo(el, {
        offset,
        duration: 1,
        onComplete: () => revealSection(el)
      });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: "smooth" });
      window.setTimeout(() => revealSection(el), 500);
    }
    // Reveal early so the section isn't blank when the camera arrives.
    window.setTimeout(() => revealSection(el), 180);
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
      ref={navRef}
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
