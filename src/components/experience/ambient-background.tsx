"use client";

import { useScroll, useTransform, motion } from "framer-motion";

/**
 * The room the experience lives in — never fully static. Extremely soft
 * volumetric light (white, sky, champagne), a masked scientific grid, and
 * depth layers that drift with scroll. White always dominates.
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
        className="animate-float-slow absolute -left-[12%] -top-[10%] h-[52vw] w-[52vw] rounded-full opacity-70 blur-3xl"
      >
        <div className="h-full w-full rounded-full [background:radial-gradient(circle,rgba(169,201,222,0.30),transparent_68%)]" />
      </motion.div>
      <motion.div
        style={{ y: y2 }}
        className="animate-float absolute -bottom-[14%] -right-[10%] h-[58vw] w-[58vw] rounded-full opacity-60 blur-3xl"
      >
        <div className="h-full w-full rounded-full [background:radial-gradient(circle,rgba(209,184,140,0.24),transparent_70%)]" />
      </motion.div>
      <motion.div
        style={{ y: y3 }}
        className="absolute left-[46%] top-[38%] h-[34vw] w-[34vw] rounded-full opacity-50 blur-3xl"
      >
        <div className="h-full w-full rounded-full [background:radial-gradient(circle,rgba(255,255,255,0.9),transparent_65%)]" />
      </motion.div>

      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(17,17,17,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.035) 1px, transparent 1px)",
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
