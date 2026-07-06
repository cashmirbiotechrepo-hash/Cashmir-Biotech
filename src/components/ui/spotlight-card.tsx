"use client";

import React, { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "gold" | "amber" | "neutral";
}

const glowMap = {
  gold: { base: 46, spread: 26 },
  amber: { base: 36, spread: 22 },
  neutral: { base: 220, spread: 0 }
};

export function SpotlightCard({ children, className, glowColor = "gold" }: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      if (!cardRef.current) return;
      cardRef.current.style.setProperty("--x", e.clientX.toFixed(2));
      cardRef.current.style.setProperty("--y", e.clientY.toFixed(2));
      cardRef.current.style.setProperty("--xp", (e.clientX / window.innerWidth).toFixed(3));
    };

    document.addEventListener("pointermove", syncPointer);
    return () => document.removeEventListener("pointermove", syncPointer);
  }, []);

  const { base, spread } = glowMap[glowColor];

  return (
    <div
      ref={cardRef}
      style={
        {
          "--base": base,
          "--spread": spread,
          "--hue": "calc(var(--base) + (var(--xp) * var(--spread)))"
        } as React.CSSProperties
      }
      className={cn(
        "relative overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container",
        "before:pointer-events-none before:absolute before:inset-0",
        "before:bg-[radial-gradient(240px_240px_at_calc(var(--x)*1px)_calc(var(--y)*1px),hsl(var(--hue)_90%_62%/0.12),transparent_70%)]",
        "after:pointer-events-none after:absolute after:inset-0",
        "after:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_40%)]",
        className
      )}
    >
      {children}
    </div>
  );
}
