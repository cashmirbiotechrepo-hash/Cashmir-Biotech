import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { listPatents, listPublishedPosts } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { TechChip } from "@/components/ui/tech-chip";
import { JournalSubscribe } from "@/components/journal/journal-subscribe";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Research Notebook",
  description:
    "Laboratory log from Cashmir Biotech — publication pipeline, field notes, patent commentary, and research diaries from Kashmir."
};

const PIPELINE = [
  { stage: "Collection", progress: 72, note: "Himalayan flora seasons" },
  { stage: "Extraction", progress: 58, note: "Fraction isolation" },
  { stage: "Validation", progress: 41, note: "Independent assay" },
  { stage: "Writing", progress: 18, note: "Manuscripts in draft" },
  { stage: "Peer review", progress: 0, note: "Queued Q4 2026" }
] as const;

const NOTEBOOKS = [
  {
    id: "001",
    title: "Why Kashmir flora?",
    kind: "Field notes",
    status: "In draft",
    read: "6 min"
  },
  {
    id: "002",
    title: "How independent assay works",
    kind: "Method",
    status: "Outline",
    read: "8 min"
  },
  {
    id: "003",
    title: "Patent diary — Syringaresinol",
    kind: "IP commentary",
    status: "Queued",
    read: "5 min"
  },
  {
    id: "004",
    title: "Behind Magic Food TaxO",
    kind: "Product research",
    status: "In draft",
    read: "10 min"
  },
  {
    id: "005",
    title: "Building the bioinformatics suite",
    kind: "Engineering",
    status: "Queued",
    read: "7 min"
  },
  {
    id: "006",
    title: "Collection season 2026",
    kind: "Field notes",
    status: "Open log",
    read: "—"
  },
  {
    id: "007",
    title: "Failed experiments we’ll ship anyway",
    kind: "Lab diary",
    status: "Sketch",
    read: "4 min"
  },
  {
    id: "008",
    title: "What LC-MS taught us this quarter",
    kind: "Assay notes",
    status: "Outline",
    read: "9 min"
  }
] as const;

function formatDate(date: Date | null) {
  return new Date(date ?? Date.now()).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export default async function BlogPage() {
  let posts: Awaited<ReturnType<typeof listPublishedPosts>> = [];
  let patents: Awaited<ReturnType<typeof listPatents>> = [];

  try {
    [posts, patents] = await Promise.all([
      listPublishedPosts(),
      listPatents().catch(() => [])
    ]);
  } catch (error) {
    logger.error({ err: error }, "Failed to load journal");
  }

  const featured = posts[0] ?? null;
  const rest = featured ? posts.slice(1) : posts;
  const commentary = patents.slice(0, 3);

  return (
    <div className="pb-16">
      {/* Hero — publishing, not landing */}
      <header className="frame relative pb-8 pt-28 md:pb-10 md:pt-32">
        <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div>
            <Reveal>
              <TechChip className="mb-4 !text-ink-soft">Research notebook</TechChip>
            </Reveal>
            <h1 className="max-w-[14ch] text-[clamp(2.2rem,5vw,3.75rem)] font-light leading-[1.04] tracking-tightest [&_.text-gold]:font-light [&_.text-gold]:text-gold/80">
              <RevealText text="Laboratory log. Still writing." accentWords={[2]} />
            </h1>
            <Reveal delay={0.08}>
              <p className="mt-5 max-w-md text-[14px] leading-relaxed text-ink-mute">
                Field notes, assay diaries, patent commentary, and publication drafts — the
                process behind Cashmir Biotech, as it happens.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} y={18}>
            <aside className="border-l border-ink/10 pl-6 md:pl-8">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Status</p>
              <p className="mt-2 text-lg font-light tracking-tight text-ink">Research is ongoing</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">
                First formal publication expected{" "}
                <span className="text-ink">Q4 2026</span>. The notebook fills as manuscripts leave
                the bench.
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-ink/8 pt-4">
                <div>
                  <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">Published</dt>
                  <dd className="text-xl font-light text-ink">{posts.length}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">In pipeline</dt>
                  <dd className="text-xl font-light text-ink">{NOTEBOOKS.length}</dd>
                </div>
              </dl>
            </aside>
          </Reveal>
        </div>
      </header>

      {/* Publication pipeline — always alive */}
      <section className="frame border-t border-ink/8 py-10 md:py-12">
        <Reveal>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Publication pipeline</p>
          <h2 className="mt-2 text-xl font-light tracking-tight text-ink">From collection to peer review</h2>
        </Reveal>
        <ul className="mt-8 space-y-5">
          {PIPELINE.map((row, i) => (
            <Reveal key={row.stage} delay={0.04 * i} y={14}>
              <li className="grid grid-cols-[7rem_1fr] items-center gap-4 sm:grid-cols-[9rem_1fr_8rem]">
                <span className="text-[14px] font-medium text-ink">{row.stage}</span>
                <div className="h-px bg-ink/10">
                  <div className="h-px bg-gold transition-all" style={{ width: `${row.progress}%` }} />
                </div>
                <span className="col-span-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint sm:col-span-1 sm:text-right">
                  {row.note}
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Featured — real post or lead notebook entry */}
      <section className="frame border-t border-ink/8 py-10 md:py-12">
        <Reveal>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">
            {featured ? "Latest entry" : "Featured draft"}
          </p>
        </Reveal>
        {featured ? (
          <Reveal y={20}>
            <Link
              href={`/blog/${featured.slug}`}
              data-cursor="Read"
              className="group mt-4 grid gap-8 border-t border-ink/15 pt-8 md:grid-cols-[1.1fr_0.9fr]"
            >
              <div>
                <p className="font-mono text-[10px] text-ink-faint">{formatDate(featured.publishedAt)}</p>
                <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.35rem)] font-light leading-snug tracking-tight text-ink">
                  {featured.title}
                </h2>
                {featured.excerpt ? (
                  <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-mute">{featured.excerpt}</p>
                ) : null}
                <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink group-hover:text-gold">
                  Read entry
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
              {featured.coverImageUrl ? (
                <div className="relative aspect-[16/10] overflow-hidden bg-pearl">
                  <Image
                    src={featured.coverImageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 45vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-end border border-ink/8 bg-pearl/50 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    Research note
                  </p>
                </div>
              )}
            </Link>
          </Reveal>
        ) : (
          <Reveal y={20}>
            <div className="mt-4 border-t border-ink/15 pt-8">
              <p className="text-[14px] font-light text-ink-mute">The first manuscript is currently being drafted.</p>
            </div>
          </Reveal>
        )}
      </section>

      {/* Notebook index */}
      <section className="frame border-t border-ink/8 py-10 md:py-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Lab notebook</p>
            <h2 className="mt-1 text-xl font-light tracking-tight text-ink">Entries in progress</h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Inside Cashmir Biotech
          </p>
        </div>
        <ul className="mt-6 divide-y divide-ink/8 border-y border-ink/8">
          {NOTEBOOKS.map((n, i) => (
            <Reveal key={n.id} delay={0.02 * i}>
              <li className="grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-3 py-3.5 sm:grid-cols-[4rem_7rem_1fr_5rem_4rem]">
                <span className="font-mono text-[11px] text-gold">{n.id}</span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint sm:block">
                  {n.kind}
                </span>
                <span className="text-[14px] font-light text-ink">{n.title}</span>
                <span className="hidden text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute sm:block">
                  {n.status}
                </span>
                <span className="text-right font-mono text-[10px] text-ink-faint">{n.read}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Patent commentary */}
      {commentary.length > 0 ? (
        <section className="frame border-t border-ink/8 py-10 md:py-12">
          <Reveal>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Patent commentary</p>
            <h2 className="mt-1 text-xl font-light tracking-tight text-ink">Short essays from the register</h2>
          </Reveal>
          <div className="mt-6 grid gap-0 sm:grid-cols-3">
            {commentary.map((p, i) => (
              <Reveal key={p.id} delay={0.04 * i} y={16}>
                <Link
                  href="/patents"
                  className="group block border-t border-ink/10 py-5 pr-4 transition-colors hover:bg-pearl/40 sm:border-t-0 sm:border-l sm:border-ink/10 sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
                >
                  <p className="font-mono text-[10px] text-gold">{p.patentCode}</p>
                  <h3 className="mt-2 text-[14px] font-light leading-snug tracking-tight text-ink line-clamp-3">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-ink-mute">
                    {p.summary.split(/(?<=[.!?])\s+/)[0]}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[12px] text-ink-mute group-hover:text-ink">
                    Commentary soon
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* Published archive when posts exist beyond featured */}
      {rest.length > 0 ? (
        <section className="frame border-t border-ink/8 py-10 md:py-12">
          <Reveal>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Archive</p>
            <h2 className="mt-1 text-xl font-light tracking-tight text-ink">Published entries</h2>
          </Reveal>
          <ul className="mt-6 divide-y divide-ink/8 border-t border-ink/8">
            {rest.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <span className="text-[15px] font-light text-ink group-hover:text-ink-soft">{post.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                    {formatDate(post.publishedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="frame border-t border-ink/8 py-10 md:py-12">
          <Reveal>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Reading list</p>
            <h2 className="mt-1 text-xl font-light tracking-tight text-ink">Open while we write</h2>
          </Reveal>
          <ul className="mt-6 space-y-0 border-t border-ink/8">
            {[
              { label: "Patent registry", href: "/patents", note: "Full IP ledger" },
              { label: "Bioinformatics suite", href: "/tools", note: "Live engines" },
              { label: "Formulations", href: "/products", note: "Assayed products" },
              { label: "Research board", href: "/team", note: "SKUAST-K model" }
            ].map((item) => (
              <li key={item.href} className="border-b border-ink/8">
                <Link
                  href={item.href}
                  className="flex items-baseline justify-between gap-4 py-3.5 text-[14px] text-ink hover:text-ink-soft"
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {item.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Newsletter */}
      <section className="frame border-t border-ink/8 py-10 md:py-12">
        <Reveal>
          <div className="max-w-xl">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Laboratory log</p>
            <h2 className="mt-2 text-xl font-light tracking-tight text-ink">
              Get notified when an entry publishes
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">
              Occasional notes from the bench and the register — not a marketing drip.
            </p>
            <JournalSubscribe />
          </div>
        </Reveal>
      </section>

      {/* Close */}
      <section className="frame pb-4">
        <Reveal>
          <div className="flex flex-col justify-between gap-4 border-t border-ink/8 py-8 sm:flex-row sm:items-center">
            <p className="text-sm text-ink-mute">
              For collaboration or media:{" "}
              <Link href="/contact" className="text-ink underline-offset-4 hover:underline">
                contact the lab
              </Link>
              .
            </p>
            <Link
              href="/patents"
              className="inline-flex items-center gap-1 text-[13px] text-ink underline-offset-4 hover:underline"
            >
              Continue in the registry
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
