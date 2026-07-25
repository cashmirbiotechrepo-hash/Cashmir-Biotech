"use client";

import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { HeroProduct } from "@/components/home/sections/hero-product";
import { useIntro } from "@/components/experience/intro-context";
import { LuxeButton } from "@/components/ui/luxe-button";
import { RevealText } from "@/components/ui/reveal";
import type { HomeContent } from "@/components/home/content";

export function Hero({ content }: { content: HomeContent }) {
  const { ready } = useIntro();
  const { hero } = content;

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden pb-16 pt-24 md:pb-16 md:pt-32"
    >
      <div className="frame grid w-full grid-cols-1 items-center gap-6 md:gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* Copy — sits under the jar on small screens; keep compact so CTAs aren’t pushed into the next scroll */}
        <div className="relative z-10 order-2 lg:order-1">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.1 }}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute"
          >
            {hero.eyebrow}
          </motion.p>

          <h1 className="display-hero mt-4 text-[clamp(2.15rem,7vw,5.4rem)] md:mt-7">
            <RevealText
              text={hero.title}
              accentWords={hero.accentWords}
              play={ready}
              delay={0.35}
              stagger={0.06}
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
            animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.7 }}
            className="mt-4 max-w-md text-[14px] leading-relaxed text-ink-mute md:mt-8 md:text-[15px]"
          >
            {hero.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.9 }}
            className="mt-7 flex flex-wrap items-center gap-3 md:mt-11 md:gap-4"
          >
            <LuxeButton href={hero.ctaPrimaryHref} variant="primary" magnetic={false}>
              {hero.ctaPrimaryText}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </LuxeButton>
            <LuxeButton href={hero.ctaSecondaryHref} variant="ghost" magnetic={false}>
              {hero.ctaSecondaryText}
            </LuxeButton>
          </motion.div>
        </div>

        {/* Product — capped height on phone so it doesn’t eat the whole first screen */}
        <div className="relative order-1 mx-auto h-[34vh] min-h-[200px] max-h-[260px] w-full sm:max-h-[300px] md:mx-0 md:h-[52vh] md:max-h-none md:min-h-[320px] lg:order-2 lg:h-[70vh]">
          <HeroProduct ready={ready} />
        </div>
      </div>

      {/* Desktop only — on phones it collided with the CTA row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 md:flex"
        aria-hidden
      >
        <span className="technical">Scroll</span>
        <span className="relative h-10 w-px overflow-hidden bg-ink/15">
          <span className="animate-scroll-line absolute inset-x-0 top-0 h-full bg-ink" />
        </span>
      </motion.div>
    </section>
  );
}
