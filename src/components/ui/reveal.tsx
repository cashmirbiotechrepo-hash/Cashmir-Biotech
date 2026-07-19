"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
};

/** Generic blur + rise reveal for any block entering the viewport. */
export function Reveal({ children, className, delay = 0, y = 34, once = true }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Programmatic Lenis scrolls can miss whileInView; product tabs dispatch this.
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onForce = () => setForced(true);
    node.addEventListener("cb:reveal", onForce);
    return () => node.removeEventListener("cb:reveal", onForce);
  }, []);

  return (
    <motion.div
      ref={ref}
      data-reveal
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      animate={forced ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
      whileInView={forced ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      // Generous margins so Lenis jump-scrolls still trip the observer; amount
      // "some" fires as soon as any pixel is visible.
      viewport={{ once, amount: "some", margin: "120px 0px 120px 0px" }}
      transition={{ duration: 0.55, ease: EASE_OUT_EXPO, delay: forced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

const wordContainer: Variants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger }
  })
};

const wordChild: Variants = {
  hidden: { y: "115%", opacity: 0 },
  visible: {
    y: "0%",
    opacity: 1,
    transition: { duration: 1, ease: EASE_OUT_EXPO }
  }
};

type RevealTextProps = {
  text: string;
  className?: string;
  /** Word indexes to render in the champagne-gold signature treatment. */
  accentWords?: number[];
  delay?: number;
  stagger?: number;
  /**
   * When provided, animation is driven by this flag instead of scroll — used to
   * hold the hero until the loader has lifted.
   */
  play?: boolean;
};

/**
 * Line/word mask reveal. Each word rises out of an overflow-hidden mask with a
 * staggered delay — the editorial signature of the hero and section titles.
 */
export function RevealText({
  text,
  className,
  accentWords = [],
  delay = 0,
  stagger = 0.055,
  play
}: RevealTextProps) {
  const words = text.split(" ");
  const accent = new Set(accentWords);

  const controlProps =
    play === undefined
      ? {
          whileInView: "visible" as const,
          viewport: { once: true, margin: "0px 0px -10% 0px" }
        }
      : { animate: play ? "visible" : "hidden" };

  return (
    <motion.span
      className={cn("inline", className)}
      variants={wordContainer}
      custom={stagger}
      initial="hidden"
      transition={{ delayChildren: delay }}
      aria-label={text}
      {...controlProps}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-top"
          aria-hidden
        >
          <motion.span
            variants={wordChild}
            className={cn(
              "inline-block will-change-transform",
              accent.has(i) && "text-gold"
            )}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
