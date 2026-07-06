import { Header2 } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { listPatents } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import type { Patent } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Patents & Research · Cashmir Biotech" };

export default async function PatentsPage() {
  let patents: Patent[] = [];
  try {
    patents = await listPatents();
  } catch (error) {
    logger.error({ event: "patents_fetch_failed", err: error }, "failed to load patents");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Header2 />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-brand">Proof Layer</p>
        <h1 className="mb-10 mt-2 text-4xl font-bold [font-family:var(--font-headline)]">Patents & Scientific Registry</h1>
        {patents.length === 0 ? (
          <p className="text-on-muted">No patents have been published yet. Please check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {patents.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 transition-colors duration-300 hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-primary-brand">{p.patentCode}</p>
                  <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-brand">
                    {p.status}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold [font-family:var(--font-headline)]">{p.title}</h2>
                <p className="mt-3 leading-relaxed text-on-muted">{p.summary}</p>
                <p className="mt-4 border-t border-outline-variant/20 pt-4 text-sm text-on-muted">
                  {p.jurisdiction} · Published{" "}
                  {p.publishedAt.toLocaleDateString("en-IN", { year: "numeric", month: "short" })}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
