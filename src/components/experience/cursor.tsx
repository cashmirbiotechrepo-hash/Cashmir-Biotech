"use client";

import { useEffect, useRef, useState } from "react";

const LERP = 0.18;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const INTERACTIVE = "a, button, [data-cursor], [data-tilt], input, textarea";

/**
 * Custom cursor: a precise ink dot, a lagging ring that swells over interactive
 * targets, and a soft champagne glow. Uses event delegation so it keeps working
 * across client-side route changes. Fine-pointer only, and fully disabled for
 * touch or reduced-motion users (native cursor restored).
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    setEnabled(true);
    document.documentElement.classList.add("cursor-hidden");

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: mouse.x, y: mouse.y };
    let raf = 0;

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate(-50%, -50%)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate(-50%, -50%)`;
      }
    };

    const loop = () => {
      ring.x = lerp(ring.x, mouse.x, LERP);
      ring.y = lerp(ring.y, mouse.y, LERP);
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    const setLabel = (text: string) => {
      const el = labelRef.current;
      if (!el) return;
      el.textContent = text;
      el.style.opacity = text ? "1" : "0";
    };

    const onOver = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(INTERACTIVE);
      if (!target) return;
      ringRef.current?.classList.add("cursor-ring--big");
      glowRef.current?.classList.add("cursor-glow--on");
      setLabel(target.getAttribute("data-cursor") ?? "");
    };

    const onOut = (event: MouseEvent) => {
      const from = (event.target as HTMLElement | null)?.closest<HTMLElement>(INTERACTIVE);
      const to = (event.relatedTarget as HTMLElement | null)?.closest<HTMLElement>(INTERACTIVE);
      if (from && from !== to) {
        ringRef.current?.classList.remove("cursor-ring--big");
        glowRef.current?.classList.remove("cursor-glow--on");
        setLabel("");
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.documentElement.classList.remove("cursor-hidden");
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={glowRef}
        aria-hidden
        className="cursor-glow pointer-events-none fixed left-0 top-0 z-[95] h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-300 [background:radial-gradient(circle,rgba(184,148,88,0.28),transparent_65%)]"
      />
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[96] flex h-9 w-9 items-center justify-center rounded-full border border-ink/40 transition-[width,height,background-color,border-color] duration-300 ease-out"
      >
        <span
          ref={labelRef}
          className="font-mono text-[8px] uppercase tracking-[0.15em] text-ink opacity-0 transition-opacity duration-200"
        />
      </div>
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[97] h-1.5 w-1.5 rounded-full bg-ink mix-blend-difference"
      />
      <style jsx global>{`
        .cursor-ring--big {
          width: 96px;
          height: 96px;
          background-color: rgb(184 148 88 / 0.1);
          border-color: rgb(184 148 88 / 0.6);
        }
        .cursor-glow--on {
          opacity: 1;
        }
      `}</style>
    </>
  );
}
