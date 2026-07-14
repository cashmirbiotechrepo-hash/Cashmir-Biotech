"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity
} from "framer-motion";

const BASE_VELOCITY = 1.2; // % of the track width per second — calm editorial drift

/** Seamless modulo wrap (no dependency on framer's internal export). */
function wrapValue(min: number, max: number, value: number) {
  const range = max - min;
  return (((value - min) % range) + range) % range + min;
}

function Row({ items }: { items: string[] }) {
  return (
    <span className="flex shrink-0 whitespace-nowrap">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="mx-8 flex items-center gap-8">
          <span
            className={
              i % 2 === 0
                ? "text-[clamp(2rem,5vw,4.5rem)] font-light leading-none text-ink/[0.1]"
                : "text-[clamp(2rem,5vw,4.5rem)] font-light leading-none text-transparent [-webkit-text-stroke:1px_rgba(17,17,17,0.18)]"
            }
          >
            {item}
          </span>
          <span className="h-2 w-2 shrink-0 rounded-full bg-gold/60" />
        </span>
      ))}
    </span>
  );
}

/**
 * Editorial marquee driven entirely on the compositor. A single motion value is
 * advanced each frame and wrapped seamlessly across four duplicated rows — no
 * CSS/inline transform conflict. It always drifts; scroll velocity smoothly
 * modulates speed and direction, and the skew lives on a separate outer layer.
 */
export function Marquee({ items }: { items: string[] }) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 40,
    stiffness: 220,
    mass: 0.4
  });
  const velocityFactor = useTransform(smoothVelocity, [-1600, 0, 1600], [-4, 0, 4], {
    clamp: false
  });
  const skew = useTransform(smoothVelocity, [-1600, 0, 1600], [-4, 0, 4], { clamp: true });

  const x = useTransform(baseX, (v) => `${wrapValue(-50, 0, v)}%`);
  const direction = useRef(1);

  const [velocityEnabled, setVelocityEnabled] = useState(true);
  useEffect(() => {
    // Base drift always runs; only the scroll-reactive boost respects the setting.
    setVelocityEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useAnimationFrame((_, delta) => {
    if (!delta) return;
    let moveBy = direction.current * BASE_VELOCITY * (delta / 1000);
    if (velocityEnabled) {
      const factor = velocityFactor.get();
      if (factor < 0) direction.current = -1;
      else if (factor > 0) direction.current = 1;
      moveBy += moveBy * factor;
    }
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <section className="relative overflow-hidden border-y border-ink/10 bg-paper/40 py-12 backdrop-blur-sm">
      <motion.div style={{ skewX: skew }} className="flex will-change-transform">
        <motion.div style={{ x }} className="flex will-change-transform">
          <Row items={items} />
          <Row items={items} />
          <Row items={items} />
          <Row items={items} />
        </motion.div>
      </motion.div>
    </section>
  );
}
