import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import {
  listActiveProducts,
  listPatents,
  listPublishedPosts
} from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { TechChip } from "@/components/ui/tech-chip";
import { LuxeButton } from "@/components/ui/luxe-button";
import { SITE_CONTACT } from "@/lib/site-contact";
import { ShopFaq } from "@/components/shop/shop-faq";
import { ShopComingSoonCard } from "@/components/shop/shop-product-card";
import { ShopCatalog } from "@/components/shop/shop-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Order Cashmir Biotech's clinical-precision functional foods and supplements, engineered from Himalayan biodiversity."
};

const PROCESS = [
  { step: "01", label: "Select", detail: "Kashmiri flora" },
  { step: "02", label: "Isolate", detail: "Active fractions" },
  { step: "03", label: "Assay", detail: "Independent verify" },
  { step: "04", label: "Finish", detail: "Clinical label" },
  { step: "05", label: "Release", detail: "Traceable lot" }
] as const;

const PILLARS = [
  {
    title: "Molecule first",
    body: "Active fractions characterised before format. The molecule leads."
  },
  {
    title: "Assay before shelf",
    body: "Independent verification against specification — every release lot."
  },
  {
    title: "Kashmiri origin",
    body: "Altitude flora chosen for chemistry, finished to clinical labeling."
  }
] as const;

const PIPELINE = [
  {
    title: "Research kits",
    blurb: "Assay-ready fractions for partner labs and institutional collaborators.",
    status: "In development",
    year: "2026–27",
    molecule: "Multi-fraction",
    category: "Research",
    readiness: 62,
    partner: "SKUAST-K"
  },
  {
    title: "Future formulations",
    blurb: "Next molecules from the SKUAST-K faculty–student pipeline.",
    status: "Discovery",
    year: "2027+",
    molecule: "Screening",
    category: "Nutrition",
    readiness: 28,
    partner: "Faculty lab"
  }
] as const;

const SHOP_FAQS = [
  {
    q: "How do I order?",
    a: "Open a formula, checkout with Razorpay. Batch documents available on request after purchase."
  },
  {
    q: "Are these medicines?",
    a: "No — FSSAI-aligned functional foods and nutritional compounds. Research-backed, not prescription drugs."
  },
  {
    q: "Where are the patents?",
    a: "The public patents registry lists codes and jurisdictions. Linked formulas also show them on the product page."
  }
] as const;

function formatPostDate(d: Date | null) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);
}

export default async function ProductsPage() {
  let products: Awaited<ReturnType<typeof listActiveProducts>> = [];
  let patents: Awaited<ReturnType<typeof listPatents>> = [];
  let posts: Awaited<ReturnType<typeof listPublishedPosts>> = [];

  try {
    [products, patents, posts] = await Promise.all([
      listActiveProducts(),
      listPatents(),
      listPublishedPosts().catch(() => [])
    ]);
  } catch (error) {
    logger.error({ err: error }, "Failed to load shop catalog");
  }

  const featured = products.find((p) => p.featured) ?? products[0] ?? null;
  const catalog = featured ? products.filter((p) => p.id !== featured.id) : products;
  const categories = [...new Set(products.map((p) => p.category))];
  const patentCount = patents.length;
  const flagshipPatent = patents[0] ?? null;
  const otherPatents = patents.slice(1, 4);
  const journalPosts = posts.slice(0, 3);

  return (
    <div className="pb-12">
      {/* ── Hero: one compact beat, products immediately below ──────── */}
      <header className="frame relative pb-5 pt-24 md:pt-28">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <Reveal>
              <TechChip className="mb-3 !text-ink-soft">The Shop</TechChip>
            </Reveal>
            <h1 className="max-w-[18ch] text-[clamp(1.7rem,3.4vw,2.6rem)] font-light leading-[1.08] tracking-tightest [&_.text-gold]:font-light [&_.text-gold]:text-gold/75">
              <RevealText text="Nutrition, engineered molecule-first." accentWords={[2]} />
            </h1>
          </div>
          <Reveal delay={0.06}>
            <p className="max-w-xs text-[13px] leading-relaxed text-ink-mute">
              Patent-backed formulas from Himalayan flora — assayed, finished, orderable.{" "}
              <Link href="#method" className="text-ink underline-offset-4 hover:underline">
                The method
              </Link>
            </p>
          </Reveal>
        </div>

        {/* Proof strip — one quiet line, not a stats section */}
        <Reveal delay={0.1}>
          <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-ink/8 pt-3 font-mono text-[10px] uppercase tracking-[0.13em] text-ink-soft">
            <span className="text-ink">{patentCount > 0 ? patentCount : 12} patents</span>
            <span aria-hidden className="text-ink/20">·</span>
            <span>SKUAST-K partner</span>
            <span aria-hidden className="text-ink/20">·</span>
            <span>Kashmir origin</span>
            <span aria-hidden className="text-ink/20">·</span>
            <span>Every lot assayed</span>
          </p>
        </Reveal>
      </header>

      {/* ── Catalog first: featured + sticky toolbar + dense grid ────── */}
      <section id="catalog" className="frame scroll-mt-24 pb-10 pt-1 md:pb-12">
        {products.length === 0 ? (
          <Reveal>
            <div className="px-4 py-12 text-center">
              <p className="technical mb-3 !text-ink-soft">No products published yet</p>
              <p className="mx-auto max-w-md text-sm text-ink-mute">
                The catalog is being prepared. Reach out for current availability.
              </p>
              <div className="mt-6 flex justify-center">
                <LuxeButton href={`mailto:${SITE_CONTACT.primaryEmail}`} variant="ghost" magnetic={false}>
                  Contact us
                </LuxeButton>
              </div>
            </div>
          </Reveal>
        ) : (
          <ShopCatalog
            featured={featured}
            catalog={catalog}
            categories={categories}
          />
        )}
      </section>

      {/* ── Pipeline — supporting band after the shopping is done ────── */}
      <section id="pipeline" className="frame scroll-mt-28 border-t border-ink/8 py-7 md:py-9">
        <Reveal>
          <p className="technical mb-0.5 !text-ink-soft">Pipeline</p>
          <h2 className="text-lg font-light tracking-tight text-ink">Not yet on the shelf</h2>
        </Reveal>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl">
          {PIPELINE.map((item, i) => (
            <Reveal key={item.title} delay={0.04 * i} y={18}>
              <ShopComingSoonCard {...item} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Method: the science, for readers who keep scrolling ──────── */}
      <section id="method" className="frame scroll-mt-28 border-t border-ink/8 py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="technical mb-2 !text-ink-soft">The method</p>
              <h2 className="text-[clamp(1.35rem,2.2vw,1.75rem)] font-light tracking-tight text-ink">
                Why molecule-first.
              </h2>
            </Reveal>
            <div className="mt-5 space-y-5">
              {PILLARS.map((pillar, i) => (
                <Reveal key={pillar.title} delay={0.04 * i} y={16}>
                  <p className="font-mono text-[9px] text-gold">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-[14px] font-medium tracking-tight text-ink">{pillar.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">{pillar.body}</p>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={0.08} y={20} className="lg:col-span-7">
            <div className="h-full border border-ink/10 bg-pearl/50 p-5 md:p-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">Assay pipeline</p>
              <ol className="mt-5 space-y-0">
                {PROCESS.map((step, i) => (
                  <li key={step.step} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < PROCESS.length - 1 ? (
                      <span
                        className="absolute left-[11px] top-6 bottom-0 w-px bg-ink/10"
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-[9px] text-paper">
                      {step.step}
                    </span>
                    <div className="pt-0.5">
                      <p className="text-[14px] font-medium tracking-tight text-ink">{step.label}</p>
                      <p className="text-[12px] text-ink-mute">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Patents — flagship + list ────────────────────────────────── */}
      <section id="registry" className="scroll-mt-28 bg-ink py-10 text-paper md:py-12">
        <div className="frame">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <Reveal y={16}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-soft">Registry</p>
              <h2 className="mt-1.5 max-w-md text-[clamp(1.3rem,2.4vw,1.75rem)] font-light tracking-tight">
                {patentCount > 0
                  ? `${patentCount} patent${patentCount === 1 ? "" : "s"} behind the shelf`
                  : "Patent-backed science behind every formula"}
              </h2>
            </Reveal>
            <Reveal delay={0.05}>
              <Link
                href="/patents"
                className="inline-flex items-center gap-1.5 text-[13px] text-paper/80 underline-offset-4 hover:text-paper hover:underline"
              >
                Full registry
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Reveal>
          </div>

          {flagshipPatent ? (
            <Reveal y={20}>
              <Link
                href="/patents"
                className="group mt-7 grid gap-5 border border-paper/12 bg-paper/[0.04] p-5 transition-colors hover:border-gold/40 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center md:p-6"
              >
                <div className="relative mx-auto h-24 w-24 overflow-hidden bg-paper/5 sm:mx-0 sm:h-28 sm:w-28">
                  {flagshipPatent.imageUrl ? (
                    <Image
                      src={flagshipPatent.imageUrl}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-contain p-2 opacity-90 transition-opacity group-hover:opacity-100"
                    />
                  ) : (
                    <div className="grid h-full place-items-center font-mono text-[10px] text-gold-soft">
                      {flagshipPatent.patentCode}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold-soft">Flagship IP</p>
                  <p className="mt-1 font-mono text-[11px] text-paper/50">{flagshipPatent.patentCode}</p>
                  <p className="mt-2 text-[16px] font-light leading-snug text-paper md:text-lg">
                    {flagshipPatent.title}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-paper/50">
                    {flagshipPatent.summary}
                  </p>
                </div>
                <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-paper/35 transition-colors group-hover:text-gold-soft sm:block" />
              </Link>
            </Reveal>
          ) : null}

          {otherPatents.length > 0 ? (
            <ul className="mt-2 divide-y divide-paper/10 border-t border-paper/10">
              {otherPatents.map((patent, i) => (
                <Reveal key={patent.id} delay={0.03 * i} y={12}>
                  <li>
                    <Link
                      href="/patents"
                      className="group flex items-center justify-between gap-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-gold-soft">{patent.patentCode}</p>
                        <p className="truncate text-[13px] font-light text-paper/85">{patent.title}</p>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-paper/25 group-hover:text-gold-soft" />
                    </Link>
                  </li>
                </Reveal>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* ── Journal — posts or featured continuity ───────────────────── */}
      <section className="frame py-8 md:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <p className="technical mb-0.5 !text-ink-soft">Research journal</p>
            <h2 className="text-lg font-light tracking-tight text-ink">After you know what you want</h2>
          </Reveal>
          <Reveal delay={0.04}>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:underline"
            >
              Read all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>
        </div>

        {journalPosts.length > 0 ? (
          <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
            {journalPosts.map((post, i) => (
              <Reveal key={post.id} delay={0.03 * i} y={14}>
                <li>
                  <Link href={`/blog/${post.slug}`} className="group flex items-baseline justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-light text-ink group-hover:text-ink-soft">{post.title}</p>
                      {post.excerpt ? (
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-mute">{post.excerpt}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                      {formatPostDate(post.publishedAt)}
                    </span>
                  </Link>
                </li>
              </Reveal>
            ))}
          </ul>
        ) : (
          <Reveal>
            <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-mute">
              Assays, provenance notes, and institutional updates publish here as lots release.
            </p>
          </Reveal>
        )}
      </section>

      {/* ── FAQ + contact evidence panel ─────────────────────────────── */}
      <section className="frame border-t border-ink/8 py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="technical mb-3 !text-ink-soft">Before you order</p>
            </Reveal>
            <ShopFaq items={SHOP_FAQS} />
          </div>
          <Reveal delay={0.06} y={18} className="lg:col-span-5">
            <div className="h-full border border-ink/10 bg-pearl/50 p-5 md:p-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">Lab support</p>
              <p className="mt-3 text-[15px] font-light leading-snug text-ink">
                Lot codes, CoA requests, wholesale — write the lab directly.
              </p>
              <a
                href={`mailto:${SITE_CONTACT.primaryEmail}`}
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:underline"
              >
                {SITE_CONTACT.primaryEmail}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                Kashmir · India
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Closing beat ─────────────────────────────────────────────── */}
      <section className="frame pb-2">
        <Reveal>
          <div className="border border-ink/10 bg-ink px-6 py-8 text-paper md:px-10 md:py-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-soft">Ready?</p>
            <p className="mt-3 max-w-lg text-[clamp(1.35rem,2.8vw,1.85rem)] font-light tracking-tight">
              Explore a formula — or start with the science.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LuxeButton href="#catalog" variant="light" magnetic={false} className="!px-5 !py-2.5">
                Browse products
              </LuxeButton>
              <LuxeButton href="/blog" variant="ghost" magnetic={false} className="!border-paper/20 !px-5 !py-2.5 !text-paper hover:!border-paper/50">
                Research journal
              </LuxeButton>
              <Link
                href="/contact"
                className="inline-flex items-center px-2 text-[13px] text-paper/65 underline-offset-4 hover:text-paper hover:underline"
              >
                Contact
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
