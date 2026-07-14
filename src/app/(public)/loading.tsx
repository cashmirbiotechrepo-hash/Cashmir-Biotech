export default function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-5">
        <div className="h-9 w-9 animate-spin rounded-full border border-ink/15 border-t-gold" />
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">Loading</span>
      </div>
    </div>
  );
}
