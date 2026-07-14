"use client";

export default function PortalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 py-10">
      <h1 className="text-2xl font-light text-ink">Something went wrong</h1>
      <p className="text-sm text-ink-mute">{error.message || "Could not load this portal page."}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper"
      >
        Try again
      </button>
    </div>
  );
}
