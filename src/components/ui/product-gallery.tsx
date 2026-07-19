"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, X } from "lucide-react";
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

/** Fullscreen inspection view — tap anywhere or Esc to dismiss. */
function Lightbox({
  src,
  alt,
  onClose
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — enlarged`}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-white p-4 sm:p-10"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close enlarged image"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-neutral-900 transition-colors hover:bg-black/10"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <motion.div
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
        className="relative h-full w-full"
      >
        <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" priority />
      </motion.div>
    </motion.div>
  );
}

/** Product imagery. Hero mode: dominant image, inspectable thumbnails, fullscreen zoom. */
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
  const [zoomed, setZoomed] = useState(false);
  const current = all[active] ?? imageUrl;
  const isHero = variant === "hero";
  const closeZoom = useCallback(() => setZoomed(false), []);

  if (isHero) {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className="group/gallery relative w-full overflow-hidden bg-paper max-md:-mx-6 max-md:w-[calc(100%+3rem)]">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
              >
                <button
                  type="button"
                  onClick={() => setZoomed(true)}
                  aria-label="View image fullscreen"
                  className="relative block aspect-square w-full cursor-zoom-in md:hidden"
                >
                  <Image
                    src={current}
                    alt={name}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomed(true)}
                  aria-label="View image fullscreen"
                  className="relative hidden w-full cursor-zoom-in md:block"
                >
                  <ParallaxProductImage src={current} alt={name} priority sizes="48vw" />
                </button>
              </motion.div>
            ) : (
              <div className="flex aspect-square items-center justify-center">
                <div className="animate-breathe h-28 w-28 rounded-full bg-[radial-gradient(circle_at_34%_30%,rgba(255,255,255,0.95),rgba(209,184,140,0.35)_60%,transparent)]" />
              </div>
            )}
          </AnimatePresence>
          {current ? (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-neutral-700 shadow-sm backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover/gallery:opacity-100"
            >
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </span>
          ) : null}
          <span className="sr-only">{category}</span>
        </div>

        {all.length > 1 ? (
          <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 md:mt-4">
            {all.map((u, i) => (
              <button
                key={`thumb-${u}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Image ${i + 1} of ${all.length}`}
                className={cn(
                  "relative size-16 shrink-0 overflow-hidden bg-paper opacity-60 transition-all duration-400 ease-expo hover:opacity-100 md:size-20",
                  i === active && "opacity-100 ring-1 ring-ink/40"
                )}
              >
                <Image src={u} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        <AnimatePresence>
          {zoomed && current ? <Lightbox src={current} alt={name} onClose={closeZoom} /> : null}
        </AnimatePresence>
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
