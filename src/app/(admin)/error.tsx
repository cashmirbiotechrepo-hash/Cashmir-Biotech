"use client";

import { useEffect } from "react";
import Link from "next/link";

import * as Sentry from "@sentry/nextjs";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "admin" } });
    document.body.style.overflow = "";
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-ivory px-6 text-center">
      <h1 className="text-2xl font-light tracking-tight text-ink">Console error</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-mute">
        Something went wrong loading the admin console.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-sm text-paper transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/admin/login"
          className="inline-flex h-11 items-center rounded-full border border-ink/15 px-6 text-sm text-ink transition-colors hover:border-ink"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
