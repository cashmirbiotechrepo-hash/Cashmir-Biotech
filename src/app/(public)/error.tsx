"use client";

export default function PublicGroupError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-on-surface">
      <h1 className="text-2xl font-semibold [font-family:var(--font-headline)]">Something went wrong</h1>
      <p className="max-w-md text-sm text-neutral-500">
        An unexpected error occurred while loading this page. Please try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-primary-brand px-6 py-3 text-sm font-semibold text-on-primary-container"
      >
        Try again
      </button>
    </main>
  );
}
