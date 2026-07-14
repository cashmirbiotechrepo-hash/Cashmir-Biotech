"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MolecularScene = dynamic(() => import("./molecular-scene"), {
  ssr: false,
  loading: () => null
});

/**
 * Decides whether the WebGL apparatus should mount at all. Skips the 3D scene
 * for reduced-motion users and shows a refined static fallback instead, so the
 * hero never ships an idle canvas to someone who asked for calm.
 */
export function HeroVisual() {
  // Default to the scene so ordinary users never see a fallback flash: the WebGL
  // chunk is code-split (renders null while streaming), and we only switch to the
  // static fallback if the user has explicitly requested reduced motion.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (reduced) {
    return (
      <div aria-hidden className="absolute inset-0 flex items-center justify-center">
        <div className="animate-breathe h-64 w-64 rounded-full [background:radial-gradient(circle_at_32%_30%,rgba(255,255,255,0.95),rgba(169,201,222,0.28)_60%,transparent)] md:h-80 md:w-80" />
        <div className="animate-spin-slow absolute h-72 w-72 rounded-full border border-ink/10 md:h-96 md:w-96" />
      </div>
    );
  }

  return (
    <div aria-hidden className="absolute inset-0">
      <MolecularScene />
    </div>
  );
}
