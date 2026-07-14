"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type ScrollContextValue = {
  lenis: Lenis | null;
};

const ScrollContext = createContext<ScrollContextValue>({ lenis: null });

export function useSmoothScroll() {
  return useContext(ScrollContext);
}

/**
 * Wires Lenis inertial scrolling to the GSAP ticker so ScrollTrigger-driven
 * pinning stays perfectly in sync. Degrades to native scrolling when the user
 * prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const rafHandle = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const instance = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6
    });

    setLenis(instance);

    const onScroll = () => ScrollTrigger.update();
    instance.on("scroll", onScroll);

    const raf = (time: number) => instance.raf(time * 1000);
    rafHandle.current = raf;
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      instance.off("scroll", onScroll);
      if (rafHandle.current) gsap.ticker.remove(rafHandle.current);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  return <ScrollContext.Provider value={{ lenis }}>{children}</ScrollContext.Provider>;
}
