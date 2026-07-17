"use client";

import { useEffect } from "react";

/**
 * Silently rotates the admin access token so console sessions stay open.
 * Also refreshes when the tab becomes visible again.
 */
export function AdminSessionKeepalive() {
  useEffect(() => {
    const REFRESH_MS = 5 * 60 * 1000; // every 5 minutes (access token TTL is 15m)

    async function refresh() {
      try {
        const res = await fetch("/api/admin/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });
        if (res.status === 401) {
          // Only bounce if we're already inside the console
          if (window.location.pathname.startsWith("/admin") && !window.location.pathname.startsWith("/admin/login")) {
            window.location.href = "/admin/login?expired=1";
          }
        }
      } catch {
        // Network blip — next interval will retry
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
  }, []);

  return null;
}
