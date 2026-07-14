"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO, EASE_IN_OUT } from "@/lib/motion/ease";

const WORD = "CASHMIR";
const MIN_MS = 900;
const MAX_MS = 2800;
/** Fade-out duration — must match the exit motion below. */
const EXIT_MS = 500;

/**
 * Cinematic opening: wordmark assembles, progress line, sheet lifts.
 * Clears on load+min, hard max, click, or Escape — never waits on Framer
 * animation callbacks alone (those can miss under reduced-motion / stalled rAF).
 */
export function Loader({ onComplete }: { onComplete: () => void }) {
  const [done, setDone] = useState(false);
  const completed = useRef(false);
  const exitTimer = useRef(0);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setDone(true);
    // Fail-safe: lift the shell even if onAnimationComplete never fires.
    exitTimer.current = window.setTimeout(() => {
      onComplete();
    }, EXIT_MS);
  }, [onComplete]);

  useEffect(() => {
    return () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
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
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        finish();
      }
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
      aria-busy={!done}
      onClick={finish}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-paper"
      initial={{ opacity: 1 }}
      animate={done ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: EASE_IN_OUT }}
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
          transition={{ duration: done ? 0.35 : 2.0, ease: [0.65, 0, 0.35, 1] }}
        />
      </div>

      <p className="technical mt-5">Calibrating the molecular interface</p>
      <p className="technical mt-3 !text-ink-faint">Click anywhere to continue</p>
    </motion.div>
  );
}
