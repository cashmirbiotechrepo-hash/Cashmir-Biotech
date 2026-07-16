"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Header theme toggle — sun when light is active, moon when dark is active.
 * Persists to localStorage; syncs across tabs; follows system only until first manual choice.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ThemePreference>("light");

  useEffect(() => {
    setTheme(resolveTheme());

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

  function onToggle() {
    const next: ThemePreference = theme === "dark" ? "light" : "dark";
    persistTheme(next);
    setTheme(next);
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={cn("theme-toggle", className)}
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <Sun className="theme-toggle__icon theme-toggle__icon--sun h-4 w-4" strokeWidth={1.6} aria-hidden />
      <Moon className="theme-toggle__icon theme-toggle__icon--moon h-4 w-4" strokeWidth={1.6} aria-hidden />
    </button>
  );
}
