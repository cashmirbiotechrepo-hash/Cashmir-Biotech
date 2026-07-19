"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/shop/cart-context";
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
 * Sticky in-page nav: section tabs on the left, price + Buy on the right.
 * Doubles as the persistent CTA once the hero buy panel scrolls away.
 */
export function ProductSectionNav({ sections, priceLabel, available, product }: Props) {
  const { add } = useCart();
  const router = useRouter();
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!targets.length) return;

    // Section counts as active while its top is in the upper half of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab visible when the list scrolls horizontally on phones.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

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
          className="-mb-px flex min-w-0 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              data-section={section.id}
              aria-current={active === section.id ? "true" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-2.5 py-3 text-[12px] transition-colors sm:px-3",
                active === section.id
                  ? "border-ink font-medium text-ink"
                  : "border-transparent text-ink-mute hover:text-ink"
              )}
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2.5 py-1.5 sm:gap-3">
          <span className="hidden text-[14px] font-medium tracking-tight text-ink sm:block">
            {priceLabel}
          </span>
          <button
            type="button"
            onClick={buyNow}
            disabled={soldOut}
            className="h-8 bg-ink px-3.5 text-[12px] font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
          >
            {soldOut ? "Sold out" : <>Buy <span className="sm:hidden">{priceLabel}</span><span className="hidden sm:inline">now</span></>}
          </button>
        </div>
      </div>
    </nav>
  );
}
