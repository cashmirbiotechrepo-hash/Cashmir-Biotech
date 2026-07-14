"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { ParallaxProductImage } from "@/components/shop/parallax-product-image";

type ProductGalleryProps = {
  name: string;
  category: string;
  imageUrl?: string;
  images?: string[];
  className?: string;
  variant?: "card" | "hero";
};

/** Product imagery. Hero mode keeps the product dominant — no grey frame. */
export function ProductGallery({
  name,
  category,
  imageUrl,
  images = [],
  className,
  variant = "card"
}: ProductGalleryProps) {
  const all = [imageUrl, ...images].filter((u): u is string => Boolean(u));
  const [active, setActive] = useState(0);
  const current = all[active] ?? imageUrl;
  const isHero = variant === "hero";

  if (isHero) {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className="relative w-full overflow-hidden bg-paper max-md:-mx-6 max-md:w-[calc(100%+3rem)]">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
              >
                <div className="relative aspect-square w-full md:hidden">
                  <Image
                    src={current}
                    alt={name}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                  />
                </div>
                <div className="relative hidden w-full md:block">
                  <ParallaxProductImage src={current} alt={name} priority sizes="48vw" />
                </div>
              </motion.div>
            ) : (
              <div className="flex aspect-square items-center justify-center">
                <div className="animate-breathe h-28 w-28 rounded-full bg-[radial-gradient(circle_at_34%_30%,rgba(255,255,255,0.95),rgba(209,184,140,0.35)_60%,transparent)]" />
              </div>
            )}
          </AnimatePresence>
          <span className="sr-only">{category}</span>
        </div>

        {all.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2.5 overflow-x-auto pb-1 md:mt-4 md:justify-start">
            {all.map((u, i) => (
              <button
                key={`thumb-${u}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Thumbnail ${i + 1}`}
                className={cn(
                  "relative size-12 shrink-0 overflow-hidden bg-paper opacity-65 transition-all duration-400 ease-expo hover:opacity-100 md:size-14",
                  i === active && "opacity-100 ring-1 ring-ink/30"
                )}
              >
                <Image src={u} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-paper">
        {current ? (
          <Image
            src={current}
            alt={name}
            width={600}
            height={600}
            className="h-[92%] w-auto object-contain drop-shadow-[0_18px_32px_rgba(17,17,17,0.14)]"
          />
        ) : (
          <div className="animate-breathe h-28 w-28 rounded-full bg-[radial-gradient(circle_at_34%_30%,rgba(255,255,255,0.95),rgba(209,184,140,0.35)_60%,transparent)]" />
        )}
        <span className="absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
          {category}
        </span>
      </div>

      {all.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {all.map((u, i) => (
            <button
              key={`${u}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "relative size-12 overflow-hidden bg-paper transition-opacity",
                i === active ? "opacity-100 ring-1 ring-ink/25" : "opacity-55 hover:opacity-90"
              )}
            >
              <Image src={u} alt="" fill sizes="48px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
