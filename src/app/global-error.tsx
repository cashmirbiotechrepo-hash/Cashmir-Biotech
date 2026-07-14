"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Root crash boundary — must render its own <html>/<body> (replaces the root layout).
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "global" } });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#fafaf9",
          color: "#18181b",
          textAlign: "center"
        }}
      >
        <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#b89458" }}>
          Cashmir Biotech
        </p>
        <h1 style={{ marginTop: 16, fontSize: 28, fontWeight: 300, maxWidth: 420 }}>
          Something went wrong
        </h1>
        <p style={{ marginTop: 12, maxWidth: 380, fontSize: 14, color: "#71717a", lineHeight: 1.5 }}>
          The application hit an unexpected error. Your session data is safe — please try again.
        </p>
        {error.digest ? (
          <p style={{ marginTop: 12, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a1a1aa" }}>
            Ref {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 28,
            height: 44,
            padding: "0 24px",
            borderRadius: 999,
            border: "none",
            background: "#18181b",
            color: "#fafaf9",
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
