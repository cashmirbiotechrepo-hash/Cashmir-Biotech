"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";

function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(resolveTheme());
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        applyTheme(e.newValue);
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = (e: MediaQueryListEvent) => {
      if (readStoredTheme()) return;
      const next: ThemePreference = e.matches ? "dark" : "light";
      applyTheme(next);
      setTheme(next);
    };
    mq.addEventListener("change", onSystem);

    return () => {
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", onSystem);
    };
  }, []);

  function setPreference(next: ThemePreference) {
    persistTheme(next);
    setTheme(next);
  }

  function toggle() {
    setPreference(theme === "dark" ? "light" : "dark");
  }

  return { theme, ready, setPreference, toggle };
}

/**
 * Header theme toggle — sun when light is active, moon when dark is active.
 * Persists to localStorage; syncs across tabs; follows system only until first manual choice.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemePreference();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={cn("theme-toggle", className)}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Sun className="theme-toggle__icon theme-toggle__icon--sun h-4 w-4" strokeWidth={1.6} aria-hidden />
      <Moon className="theme-toggle__icon theme-toggle__icon--moon h-4 w-4" strokeWidth={1.6} aria-hidden />
    </button>
  );
}

/**
 * Mobile-menu theme control — settings row with a compact Day / Night segment.
 * Must stay in normal document flow (no absolute/z-index tricks over nav dividers).
 */
export function ThemeSegment({ className }: { className?: string }) {
  const { theme, ready, setPreference } = useThemePreference();
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between",
        className
      )}
      role="group"
      aria-label="Appearance"
    >
      <span className="text-[15px] text-ink">Theme</span>
      <div className="relative grid h-11 w-full max-w-[12.5rem] shrink-0 grid-cols-2 rounded-full bg-ink/[0.06] p-1 min-[380px]:w-[11.5rem]">
        {ready ? (
          <motion.span
            aria-hidden
            initial={false}
            animate={{ x: isDark ? "100%" : "0%" }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-mist shadow-[0_1px_4px_rgb(0_0_0/0.12)] ring-1 ring-ink/10"
          />
        ) : null}
        <button
          type="button"
          onClick={() => setPreference("light")}
          aria-pressed={!isDark}
          className={cn(
            "relative z-[1] inline-flex items-center justify-center gap-1.5 rounded-full text-[12px] font-medium tracking-tight transition-colors duration-300",
            !isDark ? "text-ink" : "text-ink-mute"
          )}
        >
          <Sun className="h-3.5 w-3.5 opacity-80" strokeWidth={1.75} aria-hidden />
          Day
        </button>
        <button
          type="button"
          onClick={() => setPreference("dark")}
          aria-pressed={isDark}
          className={cn(
            "relative z-[1] inline-flex items-center justify-center gap-1.5 rounded-full text-[12px] font-medium tracking-tight transition-colors duration-300",
            isDark ? "text-ink" : "text-ink-mute"
          )}
        >
          <Moon className="h-3.5 w-3.5 opacity-80" strokeWidth={1.75} aria-hidden />
          Night
        </button>
      </div>
    </div>
  );
}
