import Link from "next/link";

export const metadata = {
  title: "Page not found · Cashmir Biotech"
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-paper px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(209,184,140,0.14),transparent_62%)] blur-2xl"
      />
      <p className="relative font-mono text-[11px] uppercase tracking-[0.24em] text-gold">Error 404</p>
      <h1 className="relative mt-6 text-[clamp(4rem,14vw,10rem)] font-light leading-none tracking-tightest text-ink">
        404
      </h1>
      <p className="relative mt-4 max-w-md text-sm text-ink-mute">
        This page has drifted off the map. It may have moved, or never existed.
      </p>
      <div className="relative mt-9 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-sm text-paper transition-opacity hover:opacity-90"
        >
          Back to home
        </Link>
        <Link
          href="/products"
          className="inline-flex h-11 items-center rounded-full border border-ink/15 px-6 text-sm text-ink transition-colors hover:border-ink"
        >
          Browse catalog
        </Link>
      </div>
    </main>
  );
}
