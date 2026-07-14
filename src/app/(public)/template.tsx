"use client";

import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";

/**
 * Enter transition applied on every public navigation. A template re-mounts per
 * route, so this animates each incoming page in without the exit-timing pitfalls
 * of AnimatePresence in the App Router.
 */
export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  );
}
