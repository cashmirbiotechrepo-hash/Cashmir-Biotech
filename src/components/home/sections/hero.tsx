"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { HeroProduct } from "@/components/home/sections/hero-product";
import { useIntro } from "@/components/experience/intro-context";
import { LuxeButton } from "@/components/ui/luxe-button";
import { RevealText } from "@/components/ui/reveal";
import type { HomeContent } from "@/components/home/content";

export function Hero({ content }: { content: HomeContent }) {
  const { ready } = useIntro();
  const reduceMotion = useReducedMotion();
  const { hero } = content;
  const play = ready || Boolean(reduceMotion);

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden pb-14 pt-[calc(76px+env(safe-area-inset-top))] md:pb-16 md:pt-32"
    >
      <div className="frame grid w-full grid-cols-1 items-center gap-5 md:gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="relative z-10 order-2 lg:order-1">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={play ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.1 }}
            className="max-w-[18rem] text-balance font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-ink-mute sm:max-w-none sm:text-[10px] sm:tracking-[0.18em] md:tracking-[0.2em]"
          >
            {hero.eyebrow}
          </motion.p>

          <h1 className="display-hero mt-3 text-[clamp(2.05rem,8.2vw,5.4rem)] md:mt-7">
            <RevealText
              text={hero.title}
              accentWords={hero.accentWords}
              play={play}
              delay={0.35}
              stagger={0.06}
            />
          </h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 20, filter: "blur(6px)" }}
            animate={play ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.7 }}
            className="mt-3 max-w-md text-[13px] leading-relaxed text-ink-mute sm:text-[14px] md:mt-8 md:text-[15px]"
          >
            {hero.description}
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={play ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.9 }}
            className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 md:mt-11"
          >
            <LuxeButton
              href={hero.ctaPrimaryHref}
              variant="primary"
              magnetic={false}
              className="w-full justify-center sm:w-auto"
            >
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
            <LuxeButton
              href={hero.ctaSecondaryHref}
              variant="ghost"
              magnetic={false}
              className="w-full justify-center sm:w-auto"
            >
              {hero.ctaSecondaryText}
            </LuxeButton>
          </motion.div>
        </div>

        {/* Aspect-led media — no fixed empty vh slab when the jar is loading */}
        <div className="relative order-1 mx-auto w-full max-w-[240px] sm:max-w-[280px] md:mx-0 md:max-w-none md:h-[52vh] md:min-h-[320px] lg:order-2 lg:h-[70vh]">
          <HeroProduct ready={play} />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : {}}
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
