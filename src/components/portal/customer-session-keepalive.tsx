"use client";

import { useEffect } from "react";

/**
 * Silently renews portal access tokens so customers stay signed in.
 * Runs on mount, on tab focus, and on an interval well below the access-token TTL.
 */
export function CustomerSessionKeepalive({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const REFRESH_MS = 6 * 60 * 60 * 1000; // every 6 hours

    async function refresh() {
      try {
        await fetch("/api/portal/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });
      } catch {
        // Network blip — next interval / focus will retry
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return null;
}
