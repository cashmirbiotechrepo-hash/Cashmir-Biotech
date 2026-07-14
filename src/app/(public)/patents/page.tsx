import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { listActiveProducts, listPatents } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { TechChip } from "@/components/ui/tech-chip";
import { PatentsRegistry } from "@/components/patents/patents-registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Patent Registry",
  description:
    "The Cashmir Biotech intellectual property registry — patents, designs, trademarks, and international filings behind our research."
};

export default async function PatentsPage() {
  let patents: Awaited<ReturnType<typeof listPatents>> = [];
  let products: Awaited<ReturnType<typeof listActiveProducts>> = [];

  try {
    [patents, products] = await Promise.all([
      listPatents(),
      listActiveProducts().catch(() => [])
    ]);
  } catch (error) {
    logger.error({ err: error }, "Failed to load patents");
  }

  const productByPatent = new Map(
    products.filter((p) => p.patentId).map((p) => [p.patentId as string, { name: p.name, slug: p.slug }])
  );

  const registry = patents.map((p) => ({
    id: p.id,
    patentCode: p.patentCode,
    title: p.title,
    summary: p.summary,
    status: p.status,
    lifecycleStatus: String(p.lifecycleStatus),
    jurisdiction: p.jurisdiction,
    imageUrl: p.imageUrl,
    year: new Date(p.publishedAt).getFullYear(),
    linkedProduct: productByPatent.get(p.id) ?? null
  }));

  const years = [...new Set(registry.map((p) => p.year))].sort((a, b) => b - a);
  const jurisdictions = [...new Set(registry.map((p) => p.jurisdiction))];
  const countries = jurisdictions.length;
  const linkedCount = registry.filter((p) => p.linkedProduct).length;

  return (
    <div className="pb-16">
      {/* Compact hero — narrative left, chronicle right */}
      <header className="frame relative pb-8 pt-28 md:pb-10 md:pt-32">
        <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div>
            <Reveal>
              <TechChip className="mb-4 !text-ink-soft">Registry</TechChip>
            </Reveal>
            <h1 className="max-w-[16ch] text-[clamp(2.2rem,5vw,3.75rem)] font-light leading-[1.04] tracking-tightest [&_.text-gold]:font-light [&_.text-gold]:text-gold/80">
              <RevealText text="Protected by patent, proven by research." accentWords={[2, 5]} />
            </h1>
            <Reveal delay={0.08}>
              <p className="mt-5 max-w-md text-[14px] leading-relaxed text-ink-mute">
                A history of invention — compositions, devices, trademarks, and international filings
                measured in the lab and defended in the register.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} y={20}>
            <div className="border-l border-ink/10 pl-6 md:pl-8">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Chronicle</p>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">Granted / filed</dt>
                  <dd className="text-3xl font-light tracking-tight text-ink">{registry.length || "—"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-ink/8 pt-4">
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">Jurisdictions</dt>
                    <dd className="text-xl font-light text-ink">{countries || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">Shelf-linked</dt>
                    <dd className="text-xl font-light text-ink">{linkedCount}</dd>
                  </div>
                </div>
              </dl>

              {years.length > 0 ? (
                <ol className="mt-6 space-y-0 border-t border-ink/8 pt-4">
                  {years.slice(0, 7).map((y, i) => (
                    <li key={y} className="flex items-baseline gap-3 py-1">
                      <span className="w-10 font-mono text-[11px] text-gold">{y}</span>
                      <span className="h-px flex-1 bg-ink/8" aria-hidden />
                      <span className="font-mono text-[10px] text-ink-faint">
                        {registry.filter((p) => p.year === y).length}
                        {i === 0 ? " · latest" : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </Reveal>
        </div>
      </header>

      <section className="frame border-t border-ink/8 pt-10">
        {registry.length === 0 ? (
          <Reveal>
            <div className="py-16 text-center">
              <p className="technical mb-3 !text-ink-soft">No patents published yet</p>
              <p className="mx-auto max-w-md text-sm text-ink-mute">
                Registry entries will appear here as they are granted.
              </p>
            </div>
          </Reveal>
        ) : (
          <PatentsRegistry patents={registry} years={years} jurisdictions={jurisdictions} />
        )}
      </section>

      {/* Research connections */}
      <section className="frame border-t border-ink/8 py-12 md:py-14">
        <Reveal>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Ecosystem</p>
          <h2 className="mt-2 text-xl font-light tracking-tight text-ink md:text-2xl">
            Patent → shelf → bench
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Intellectual property",
              body: "Compositions and methods protected in national and utility registers.",
              href: "#",
              cta: null
            },
            {
              step: "02",
              title: "Formulations",
              body: "Selected IP becomes nutrition you can order — assayed and labeled.",
              href: "/products",
              cta: "Shop"
            },
            {
              step: "03",
              title: "Bioinformatics",
              body: "The same rigor as engines you can run — sequence, align, assay.",
              href: "/tools",
              cta: "Tools"
            }
          ].map((item) => (
            <Reveal key={item.step} y={16}>
              <div className="border-t border-ink/10 pt-4">
                <p className="font-mono text-[10px] text-gold">{item.step}</p>
                <h3 className="mt-2 text-[15px] font-medium tracking-tight text-ink">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">{item.body}</p>
                {item.cta && item.href ? (
                  <Link
                    href={item.href}
                    className="mt-4 inline-flex items-center gap-1 text-[13px] text-ink underline-offset-4 hover:underline"
                  >
                    {item.cta}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="frame pb-4">
        <Reveal>
          <div className="border border-ink/10 bg-ink px-6 py-9 text-paper md:px-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-soft">Research continues</p>
            <p className="mt-3 max-w-lg text-[clamp(1.25rem,2.5vw,1.75rem)] font-light tracking-tight">
              Filings accumulate. The register is the ledger — products and papers are the proof.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-[13px] text-paper underline-offset-4 hover:underline"
              >
                Publications
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 text-[13px] text-paper/65 underline-offset-4 hover:text-paper hover:underline"
              >
                Formulations
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 text-[13px] text-paper/65 underline-offset-4 hover:text-paper hover:underline"
              >
                Licensing
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
