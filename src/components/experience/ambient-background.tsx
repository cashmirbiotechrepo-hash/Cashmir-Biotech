"use client";

import { useScroll, useTransform, motion } from "framer-motion";

/**
 * Ambient room light — token-driven so dark mode rebuilds atmosphere
 * (lower opacity, cooler/warmer shifts) instead of dimming light gradients.
 */
export function AmbientBackground() {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ivory">
      <motion.div
        style={{ y: y1 }}
        className="animate-float-slow absolute -left-[12%] -top-[10%] h-[52vw] w-[52vw] rounded-full opacity-70 blur-3xl dark:opacity-40"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--sky) / 0.30), transparent 68%)"
          }}
        />
      </motion.div>
      <motion.div
        style={{ y: y2 }}
        className="animate-float absolute -bottom-[14%] -right-[10%] h-[58vw] w-[58vw] rounded-full opacity-60 blur-3xl dark:opacity-35"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--gold-soft) / 0.24), transparent 70%)"
          }}
        />
      </motion.div>
      <motion.div
        style={{ y: y3 }}
        className="absolute left-[46%] top-[38%] h-[34vw] w-[34vw] rounded-full opacity-50 blur-3xl dark:opacity-25"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--paper) / 0.55), transparent 65%)"
          }}
        />
      </motion.div>

      <div
        className="absolute inset-0 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--ink) / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--ink) / 0.035) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(circle at 50% 26%, rgba(0,0,0,0.85), transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 26%, rgba(0,0,0,0.85), transparent 72%)"
        }}
      />
    </div>
  );
}
