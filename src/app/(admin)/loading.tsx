export default function AdminLoading() {
  return (
    <div
      className="flex min-h-svh items-center justify-center bg-ivory"
      role="status"
      aria-label="Loading"
    >
      <div className="h-9 w-9 animate-spin rounded-full border border-ink/15 border-t-gold" />
    </div>
  );
}
