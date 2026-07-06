export default function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary-brand border-t-transparent"
          role="status"
          aria-label="Loading"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-muted">Loading</p>
      </div>
    </div>
  );
}
