"use client";

import { useEffect } from "react";

/** Silently rotates the access token before the 24h cookie expires (session valid 7 days). */
export function AdminSessionKeepalive() {
  useEffect(() => {
    const REFRESH_MS = 12 * 60 * 60 * 1000; // every 12 hours

    async function refresh() {
      try {
        const res = await fetch("/api/admin/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });
        if (res.status === 401) {
          window.location.href = "/admin/login?expired=1";
        }
      } catch {
        // Network blip — next interval will retry
      }
    }

    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return null;
}
