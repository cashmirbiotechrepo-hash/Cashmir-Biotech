"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/** Soft pointer-tilt + hover zoom — product feels dimensional without becoming a gimmick. */
export function ParallaxProductImage({ src, alt, priority, sizes, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 120, damping: 18, mass: 0.4 });
  const y = useSpring(rawY, { stiffness: 120, damping: 18, mass: 0.4 });
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0) scale(1.02)`;

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rawX.set(px * 10);
    rawY.set(py * 8);
  }

  function onLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ perspective: 900 }}
    >
      <motion.div style={{ transform }} className="will-change-transform">
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={1200}
          priority={priority}
          sizes={sizes}
          className="h-auto w-full object-contain"
        />
      </motion.div>
    </div>
  );
}
