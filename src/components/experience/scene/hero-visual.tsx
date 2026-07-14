"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";

import * as Sentry from "@sentry/nextjs";

const MolecularScene = dynamic(() => import("./molecular-scene"), {
  ssr: false,
  loading: () => null
});

/**
 * MED-03: React Error Boundary to catch Three.js / WebGL context errors gracefully
 * without crashing the rest of the application layout.
 */
class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { errorInfo }, tags: { boundary: "hero-visual" } });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Decides whether the WebGL apparatus should mount at all. Skips the 3D scene
 * for reduced-motion users or if WebGL crashes, showing a refined static fallback instead.
 */
export function HeroVisual() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const fallback = (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center">
      <div className="animate-breathe h-64 w-64 rounded-full [background:radial-gradient(circle_at_32%_30%,rgba(255,255,255,0.95),rgba(169,201,222,0.28)_60%,transparent)] md:h-80 md:w-80" />
      <div className="animate-spin-slow absolute h-72 w-72 rounded-full border border-ink/10 md:h-96 md:w-96" />
    </div>
  );

  if (reduced) {
    return fallback;
  }

  return (
    <div aria-hidden className="absolute inset-0">
      <SceneErrorBoundary fallback={fallback}>
        <MolecularScene />
      </SceneErrorBoundary>
    </div>
  );
}
