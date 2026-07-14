"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { TiltCard } from "@/components/ui/tilt-card";
import type { HomeContent } from "@/components/home/content";

/**
 * Horizontal storytelling driven by a sticky viewport and scroll progress.
 * A tall outer section provides the scroll runway; the inner viewport sticks
 * while the track translates from 0 to -overflow. Reading scroll position
 * directly (rather than pinning) keeps it in lockstep with Lenis or native
 * scroll, on any device.
 */
export function Pipeline({ stages }: { stages: HomeContent["pipeline"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [isDesktop, setIsDesktop] = useState(false);
  const [overflow, setOverflow] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  const measure = () => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    setIsDesktop(desktop);
    setViewportH(window.innerHeight);
    const track = trackRef.current;
    if (track) {
      setOverflow(desktop ? Math.max(0, track.scrollWidth - window.innerWidth) : 0);
    }
  };

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Re-measure once after paint so late layout (fonts, images) is captured.
  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"]
  });
  const rawX = useTransform(scrollYProgress, [0, 1], [0, -overflow]);
  const x = useSpring(rawX, { stiffness: 140, damping: 28, mass: 0.4 });

  const runway = isDesktop && overflow > 0 ? { height: viewportH + overflow } : undefined;

  return (
    <section id="pipeline" ref={sectionRef} style={runway} className="relative bg-paper">
      <div
        className={
          isDesktop
            ? "sticky top-0 flex h-svh flex-col overflow-hidden"
            : "flex flex-col"
        }
      >
        <div className="frame shrink-0 pt-28 pb-6 md:pt-32 md:pb-8">
          <p className="technical mb-4">The Pipeline</p>
          <h2 className="max-w-md text-[clamp(1.8rem,3.2vw,2.75rem)] font-light leading-[1.1] tracking-tightest">
            From alpine source to clinical-ready nutrition.
          </h2>
        </div>

        <div
          className={
            isDesktop
              ? "flex min-h-0 flex-1 items-center overflow-hidden"
              : "flex items-stretch overflow-x-auto pb-10 [scrollbar-width:none]"
          }
        >
          <motion.div
            ref={trackRef}
            style={isDesktop ? { x } : undefined}
            className="flex items-stretch gap-6 px-6 will-change-transform md:gap-10 md:px-[8vw]"
          >
            {stages.map((stage, i) => {
              const dark = i % 2 === 1;
              return (
                <TiltCard
                  key={stage.index}
                  data-cursor="Stage"
                  max={6}
                  className={`group relative flex h-[clamp(340px,52vh,560px)] w-[80vw] flex-shrink-0 flex-col justify-end overflow-hidden rounded-3xl border p-8 sm:w-[62vw] md:w-[42vw] md:p-11 lg:w-[34vw] ${
                    dark
                      ? "border-ink/80 bg-ink text-paper"
                      : "border-ink/10 bg-gradient-to-b from-paper to-pearl text-ink"
                  }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-70">
                    <div
                      className={`animate-spin-slow h-48 w-48 rounded-full border ${
                        dark ? "border-paper/10" : "border-ink/5"
                      }`}
                    />
                    <div
                      className={`animate-spin-slow-rev absolute h-32 w-32 rounded-full border ${
                        dark ? "border-sky/30" : "border-sky/40"
                      }`}
                    />
                  </div>
                  <span
                    className={`relative font-mono text-[11px] uppercase tracking-[0.26em] ${
                      dark ? "text-gold-soft" : "text-gold"
                    }`}
                  >
                    Stage {stage.index}
                  </span>
                  <h3 className="relative mt-4 text-3xl font-light tracking-tight md:text-4xl">
                    {stage.title}
                  </h3>
                  <p
                    className={`relative mt-4 max-w-sm text-sm leading-relaxed ${
                      dark ? "text-paper/70" : "text-ink-mute"
                    }`}
                  >
                    {stage.body}
                  </p>
                </TiltCard>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
