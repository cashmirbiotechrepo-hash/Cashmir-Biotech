"use client";

import { useEffect } from "react";
import Link from "next/link";

import * as Sentry from "@sentry/nextjs";

export default function PublicError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "public" } });
    // A loader/menu may have locked scroll before the crash — always release it.
    document.body.style.overflow = "";
  }, [error]);

  return (
    <section className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold">Something went wrong</p>
      <h1 className="mt-6 max-w-lg text-3xl font-light tracking-tight text-ink md:text-4xl">
        We hit an unexpected error rendering this page.
      </h1>
      <p className="mt-4 max-w-md text-sm text-ink-mute">
        The issue has been logged. You can retry, or head back to the homepage.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Ref {error.digest}
        </p>
      ) : null}
      <div className="mt-9 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-sm text-paper transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full border border-ink/15 px-6 text-sm text-ink transition-colors hover:border-ink"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
