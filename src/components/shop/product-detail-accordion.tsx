"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
export type ProductDetailSection = {
  id: string;
  title: string;
  /** Plain text renders as a paragraph; a node renders as-is (e.g. spec tables). */
  body: string | React.ReactNode;
};

export function ProductDetailAccordion({
  sections,
  defaultOpenId = null
}: {
  sections: ProductDetailSection[];
  /** Open one section by id on mount; null = all closed (better on mobile). */
  defaultOpenId?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(defaultOpenId);

  // On phones, start collapsed so the buy block + trust row stay above the fold
  // and sticky dock never fights an expanded research panel.
  useEffect(() => {
    if (!defaultOpenId) return;
    if (window.matchMedia("(max-width: 639px)").matches) {
      setOpen(null);
    }
  }, [defaultOpenId]);

  return (
    <div className="divide-y divide-ink/10 border-t border-ink/10">
      {sections.map((section) => {
        const isOpen = open === section.id;
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : section.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="text-[13px] font-medium tracking-tight text-ink">{section.title}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-ink-faint transition-transform duration-400 ease-expo",
                  isOpen && "rotate-180"
                )}
                strokeWidth={1.5}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                  className="overflow-hidden"
                >
                  {typeof section.body === "string" ? (
                    <p className="pb-5 text-sm leading-relaxed text-ink-mute whitespace-pre-line">
                      {section.body}
                    </p>
                  ) : (
                    <div className="pb-5">{section.body}</div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
