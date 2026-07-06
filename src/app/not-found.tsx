import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-on-surface">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary-brand">404</p>
      <h1 className="text-3xl font-bold [font-family:var(--font-headline)]">Page not found</h1>
      <p className="max-w-md text-sm text-neutral-500">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-xl bg-primary-brand px-6 py-3 text-sm font-semibold text-on-primary-container"
      >
        Back to home
      </Link>
    </main>
  );
}
