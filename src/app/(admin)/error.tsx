"use client";

export default function AdminGroupError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-on-surface">
      <h1 className="text-xl font-semibold [font-family:var(--font-headline)]">Admin temporarily unavailable</h1>
      <p className="max-w-md text-center text-sm text-on-surface/60">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-primary-brand px-4 py-2 text-sm font-medium text-on-primary-container"
      >
        Try again
      </button>
    </div>
  );
}
