"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useMeasure from "react-use-measure";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { Reveal, RevealText } from "@/components/ui/reveal";
import type { HomeContent } from "@/components/home/content";

function FaqItem({ faq, index }: { faq: HomeContent["faqs"][number]; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const [ref, bounds] = useMeasure();

  return (
    <div className="border-b border-ink/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 py-7 text-left"
      >
        <span className="text-lg font-light tracking-tight text-ink md:text-xl">{faq.q}</span>
        <span
          className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-ink/15 text-gold transition-transform duration-400 ease-expo ${
            open ? "rotate-45" : ""
          }`}
          aria-hidden
        >
          +
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? bounds.height : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        className="overflow-hidden"
      >
        <div ref={ref}>
          <p className="max-w-xl pb-8 text-sm leading-relaxed text-ink-mute">{faq.a}</p>
        </div>
      </motion.div>
    </div>
  );
}

export function Faq({ faqs }: { faqs: HomeContent["faqs"] }) {
  return (
    <section className="relative py-24 md:py-44">
      <div className="frame grid grid-cols-1 gap-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal>
            <p className="technical mb-5">Enquiries</p>
          </Reveal>
          <h2 className="text-[clamp(2rem,3.4vw,3rem)] font-light leading-[1.08] tracking-tightest">
            <RevealText text="Answers, held to the same standard." accentWords={[1]} />
          </h2>
        </div>

        <div className="lg:col-span-8">
          <div className="border-t border-ink/10">
            {faqs.map((faq, i) => (
              <FaqItem key={faq.q} faq={faq} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
