import type { SpringOptions, Transition } from "framer-motion";

/** Signature easings shared across the experience. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_OUT_QUART = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.7, 0, 0.3, 1] as const;

/** A calm, physically-believable spring used for magnetic + tactile motion. */
export const SPRING_SOFT: SpringOptions = {
  stiffness: 150,
  damping: 20,
  mass: 0.6
};

export const SPRING_SNAPPY: SpringOptions = {
  stiffness: 320,
  damping: 30,
  mass: 0.5
};

/** Reveal transition for editorial content entering the viewport. */
export const revealTransition = (delay = 0): Transition => ({
  duration: 1.1,
  ease: EASE_OUT_EXPO,
  delay
});
