"use client";

import { useEffect } from "react";

/**
 * Silently rotates the admin access token so active console sessions stay open.
 * Strictly checks for actual user interaction (click, keydown, scroll, mousemove)
 * within the last refresh interval before rotating tokens (AUTH-12).
 */
export function AdminSessionKeepalive() {
  useEffect(() => {
    const REFRESH_MS = 5 * 60 * 1000; // every 5 minutes (access token TTL is 15m)
    const MIN_GAP_MS = 30 * 1000; // don't hammer refresh on rapid visibility flips
    let redirected = false;
    let inFlight = false;
    let lastRefreshAt = Date.now();
    let lastActivityAt = Date.now();

    const onActivity = () => {
      lastActivityAt = Date.now();
    };

    const events = ["mousedown", "keydown", "scroll", "mousemove", "touchstart"];
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    async function refresh(forceInitial = false) {
      if (redirected || inFlight) return;
      const now = Date.now();
      if (!forceInitial && now - lastRefreshAt < MIN_GAP_MS) return;

      // Do not refresh if user has been completely idle/AFK since the last refresh interval
      if (!forceInitial && now - lastActivityAt > REFRESH_MS + MIN_GAP_MS) {
        return;
      }

      inFlight = true;
      lastRefreshAt = now;
      try {
        const res = await fetch("/api/admin/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });
        if (res.status === 401) {
          if (
            window.location.pathname.startsWith("/admin") &&
            !window.location.pathname.startsWith("/admin/login")
          ) {
            redirected = true;
            await fetch("/api/admin/auth/logout", {
              method: "POST",
              credentials: "include",
              cache: "no-store"
            }).catch(() => undefined);
            window.location.replace("/admin/login?expired=1");
          }
        }
      } catch {
        // Network blip — next interval will retry if active
      } finally {
        inFlight = false;
      }
    }

    void refresh(true);
    const timer = setInterval(() => void refresh(false), REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, []);

  return null;
}
