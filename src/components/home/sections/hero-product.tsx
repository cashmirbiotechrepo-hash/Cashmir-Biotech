"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants
} from "framer-motion";
import { EASE_IN_OUT, EASE_OUT_EXPO } from "@/lib/motion/ease";

const TILT_DEG = -14;
const CYCLE_MS = 4200;

/** The flagship jar leads, then the range cycles behind it (desktop only). */
const PRODUCTS = [
  "/products/magic-food-taxo.png",
  "/products/1.png",
  "/products/4.png",
  "/products/5.png",
  "/products/6.png",
  "/products/7.png",
  "/products/8.png",
  "/products/9.png",
  "/products/10.png",
  "/products/11.png"
];

type Chip = { label: string; className: string; depth: number };

const CHIPS: Chip[] = [
  { label: "Compound purity Δ0.03", className: "left-2 top-6 lg:left-0 lg:top-8", depth: 26 },
  { label: "LC-MS verified batch", className: "right-2 top-[42%] lg:-right-2 lg:top-1/2", depth: 40 },
  { label: "Alpine origin · Kashmir", className: "bottom-6 left-4 lg:bottom-10 lg:left-6", depth: 32 }
];

const slideVariants: Variants = {
  enter: { opacity: 0, scale: 1.06, filter: "blur(8px)" },
  center: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE_OUT_EXPO }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    filter: "blur(8px)",
    transition: { duration: 0.45, ease: EASE_IN_OUT }
  }
};

function FloatingChip({
  chip,
  mx,
  my
}: {
  chip: Chip;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const x = useTransform(mx, (v) => v * chip.depth);
  const y = useTransform(my, (v) => v * chip.depth);
  return (
    <motion.div
      style={{ x, y }}
      className={`glass absolute z-30 hidden rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute lg:block ${chip.className}`}
    >
      {chip.label}
    </motion.div>
  );
}

export function HeroProduct({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allowCycle, setAllowCycle] = useState(false);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 120, damping: 18, mass: 0.6 });
  const my = useSpring(rawY, { stiffness: 120, damping: 18, mass: 0.6 });

  const px = useTransform(mx, (v) => v * 55);
  const py = useTransform(my, (v) => v * 55);
  const rotateY = useTransform(mx, [-0.5, 0.5], [10, -10]);
  const rotateX = useTransform(my, [-0.5, 0.5], [-8, 8]);

  // Cycle only on md+ — mobile keeps a stable flagship jar (no empty swap frames).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setAllowCycle(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!ready || paused || !allowCycle || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % PRODUCTS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [ready, paused, allowCycle, reduceMotion]);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!allowCycle) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    rawX.set((event.clientX - rect.left) / rect.width - 0.5);
    rawY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const onLeave = () => {
    rawX.set(0);
    rawY.set(0);
    setPaused(false);
  };

  const show = ready || reduceMotion;

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={onLeave}
      className="relative flex h-full w-full items-center justify-center [perspective:1400px]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(209,184,140,0.20),rgba(111,168,206,0.10)_45%,transparent_70%)] blur-2xl"
      />

      <motion.div
        style={allowCycle ? { x: px, y: py, rotateX, rotateY, transformPerspective: 1400 } : undefined}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94, rotate: TILT_DEG - 4 }}
        animate={
          show
            ? { opacity: 1, scale: 1, rotate: allowCycle ? TILT_DEG : 0 }
            : { opacity: 0, scale: 0.94, rotate: TILT_DEG - 4 }
        }
        transition={{ duration: reduceMotion ? 0 : 1.1, ease: EASE_OUT_EXPO, delay: reduceMotion ? 0 : 0.15 }}
        className="relative z-10 [transform-style:preserve-3d]"
      >
        <div className={allowCycle ? "animate-float" : undefined}>
          {/* Aspect-ratio frame — never a fixed empty vh box */}
          <div className="relative mx-auto aspect-[41/51] w-full max-w-[220px] sm:max-w-[260px] md:max-w-[360px] md:w-[clamp(200px,30vw,360px)]">
            {allowCycle && !reduceMotion ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={index}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 will-change-[transform,opacity,filter]"
                >
                  <Image
                    src={PRODUCTS[index]}
                    alt="Cashmir Biotech functional foods and supplements"
                    fill
                    priority={index === 0}
                    sizes="(max-width: 768px) 55vw, 32vw"
                    className="object-contain drop-shadow-[0_45px_60px_rgba(17,17,17,0.22)]"
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <Image
                src={PRODUCTS[0]}
                alt="Cashmir Biotech functional foods and supplements"
                fill
                priority
                sizes="(max-width: 768px) 55vw, 32vw"
                className="object-contain drop-shadow-[0_45px_60px_rgba(17,17,17,0.22)]"
              />
            )}
          </div>
        </div>

        <div
          aria-hidden
          className="absolute -bottom-4 left-1/2 h-6 w-2/3 -translate-x-1/2 rounded-[100%] bg-ink/15 blur-xl"
        />
      </motion.div>

      {CHIPS.map((chip) => (
        <FloatingChip key={chip.label} chip={chip} mx={mx} my={my} />
      ))}
    </div>
  );
}
