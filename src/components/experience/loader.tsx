"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO, EASE_IN_OUT } from "@/lib/motion/ease";

const WORD = "CASHMIR";
const MIN_MS = 900; // never flash by; give the wordmark time to assemble
const MAX_MS = 3600; // never punish a slow WebGL chunk indefinitely

/**
 * Cinematic opening: the wordmark assembles out of blur, a champagne light
 * sweeps across it, a progress line completes, then the sheet lifts. It clears
 * on the earliest of (window load + min time) or a hard max, and can be skipped
 * with a click or the Escape key.
 */
export function Loader({ onComplete }: { onComplete: () => void }) {
  const [done, setDone] = useState(false);
  const completed = useRef(false);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setDone(true);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish();
      return;
    }

    const mountedAt = performance.now();
    let minTimer = 0;
    const maxTimer = window.setTimeout(finish, MAX_MS);

    const settle = () => {
      const elapsed = performance.now() - mountedAt;
      const wait = Math.max(0, MIN_MS - elapsed);
      minTimer = window.setTimeout(finish, wait);
    };

    if (document.readyState === "complete") settle();
    else window.addEventListener("load", settle, { once: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
      window.removeEventListener("load", settle);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  return (
    <motion.div
      role="status"
      aria-label="Loading Cashmir Biotech"
      onClick={finish}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-paper"
      initial={{ opacity: 1 }}
      animate={done ? { opacity: 0, filter: "blur(6px)" } : { opacity: 1 }}
      transition={{ duration: 0.9, ease: EASE_IN_OUT }}
      onAnimationComplete={() => {
        if (done) onComplete();
      }}
      style={{ pointerEvents: done ? "none" : "auto" }}
    >
      <div className="relative mb-10 overflow-hidden px-2">
        <div className="flex font-sans text-3xl font-light tracking-[0.42em] text-ink md:text-5xl">
          {WORD.split("").map((letter, i) => (
            <motion.span
              key={`${letter}-${i}`}
              initial={{ opacity: 0, y: 26, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.1 + i * 0.08 }}
            >
              {letter}
            </motion.span>
          ))}
        </div>
        <motion.div
          aria-hidden
          className="absolute inset-y-0 w-1/2 -skew-x-12 [background:linear-gradient(100deg,transparent,rgba(184,148,88,0.35),transparent)]"
          initial={{ x: "-160%" }}
          animate={{ x: "260%" }}
          transition={{ duration: 1.6, ease: EASE_IN_OUT, delay: 0.7 }}
        />
      </div>

      <div className="relative h-px w-56 overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="absolute inset-y-0 left-0 bg-ink"
          initial={{ width: "0%" }}
          animate={{ width: done ? "100%" : "88%" }}
          transition={{ duration: done ? 0.4 : 2.2, ease: [0.65, 0, 0.35, 1] }}
        />
      </div>

      <p className="technical mt-5">Calibrating the molecular interface</p>
      <p className="technical mt-3 !text-ink-faint">Click to skip</p>
    </motion.div>
  );
}
