"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { cn } from "@/lib/utils";

export type ExplorerTool = {
  slug: string;
  name: string;
  blurb: string;
  engine: string;
  status: "live" | "documented";
};

export type ExplorerCategory = {
  id: string;
  number: number;
  name: string;
  summary: string;
  tools: ExplorerTool[];
};

type FlatTool = ExplorerTool & { categoryId: string; categoryName: string };

/** Slug → mini scientific vignette. Cashmir-specific — not generic icons. */
function ToolPreview({ slug, live }: { slug: string; live: boolean }) {
  const dim = live ? "" : "opacity-40";

  if (slug.includes("composition") || slug.includes("gc")) {
    return (
      <div className={cn("font-mono text-[10px] leading-relaxed tracking-wide", dim)}>
        <div className="flex justify-between text-ink">
          <span>GC%</span>
          <span className="text-gold">52.4</span>
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden bg-ink/8">
          <span className="w-[52%] bg-gold/70" />
          <span className="w-[48%] bg-ink/20" />
        </div>
        <div className="mt-2 flex justify-between text-ink-mute">
          <span>AT skew</span>
          <span>−0.08</span>
        </div>
      </div>
    );
  }

  if (slug.includes("reverse") || slug.includes("complement")) {
    return (
      <div className={cn("font-mono text-[11px] leading-relaxed", dim)}>
        <p className="tracking-[0.2em] text-ink">ATGC·GGAA</p>
        <p className="my-1 text-gold">↓</p>
        <p className="tracking-[0.2em] text-ink-mute">TTCC·GCAT</p>
      </div>
    );
  }

  if (slug.includes("translate") || slug.includes("orf")) {
    return (
      <div className={cn("space-y-1.5", dim)}>
        {["+1", "+2", "+3"].map((frame, i) => (
          <div key={frame} className="flex items-center gap-2">
            <span className="w-5 font-mono text-[9px] text-ink-faint">{frame}</span>
            <div className="h-2 flex-1 bg-ink/8">
              <div className="h-full bg-gold/60" style={{ width: `${[88, 34, 56][i]}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (slug.includes("align") || slug.includes("pairwise")) {
    return (
      <div className={cn("font-mono text-[10px] leading-[1.7] tracking-wider text-ink", dim)}>
        <p>
          MKTAY<span className="text-gold">I</span>AKQR
        </p>
        <p className="text-ink-faint">|||||:||||</p>
        <p>
          MKTAY<span className="text-gold">N</span>AKNR
        </p>
      </div>
    );
  }

  if (slug.includes("blast") || slug.includes("search")) {
    return (
      <div className={cn("grid grid-cols-2 gap-3 font-mono text-[10px]", dim)}>
        <div>
          <p className="text-ink-faint">Identity</p>
          <p className="mt-0.5 text-lg font-light text-ink">97.8%</p>
        </div>
        <div>
          <p className="text-ink-faint">Coverage</p>
          <p className="mt-0.5 text-lg font-light text-ink">95%</p>
        </div>
      </div>
    );
  }

  if (slug.includes("melting") || slug.includes("tm") || slug.includes("primer")) {
    return (
      <div className={cn("font-mono text-[10px]", dim)}>
        <p className="text-ink-faint">Tm · SantaLucia</p>
        <p className="mt-1 text-2xl font-light tracking-tight text-ink">
          62.4<span className="text-sm text-ink-mute">°C</span>
        </p>
        <p className="mt-1 text-ink-mute">ΔG −18.2 kcal/mol</p>
      </div>
    );
  }

  if (slug.includes("restriction") || slug.includes("digest")) {
    return (
      <div className={cn("flex items-end gap-1 h-10", dim)}>
        {[40, 72, 28, 90, 55, 38, 64].map((h, i) => (
          <span key={i} className="flex-1 bg-ink/15" style={{ height: `${h}%` }}>
            <span className="block h-full w-full origin-bottom scale-y-100 bg-gold/50" style={{ height: "100%" }} />
          </span>
        ))}
      </div>
    );
  }

  if (slug.includes("protein") || slug.includes("properties") || slug.includes("physico")) {
    return (
      <div className={cn("font-mono text-[10px] space-y-1", dim)}>
        <div className="flex justify-between">
          <span className="text-ink-mute">pI</span>
          <span className="text-ink">6.84</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-mute">MW</span>
          <span className="text-ink">18.4 kDa</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-mute">GRAVY</span>
          <span className="text-ink">−0.31</span>
        </div>
      </div>
    );
  }

  // Default — sequence snip
  return (
    <p className={cn("font-mono text-[10px] tracking-[0.18em] text-ink-mute", dim)}>ATGC·GTAC·…</p>
  );
}

export function ToolsExplorer({ categories }: { categories: ExplorerCategory[] }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [liveOnly, setLiveOnly] = useState(false);

  const allTools = useMemo<FlatTool[]>(
    () =>
      categories.flatMap((c) =>
        c.tools.map((t) => ({ ...t, categoryId: c.id, categoryName: c.name }))
      ),
    [categories]
  );

  const q = query.trim().toLowerCase();

  const matches = useMemo(
    () =>
      allTools.filter((t) => {
        if (activeCat !== "all" && t.categoryId !== activeCat) return false;
        if (liveOnly && t.status !== "live") return false;
        if (q && !`${t.name} ${t.blurb} ${t.engine} ${t.categoryName}`.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      }),
    [allTools, activeCat, liveOnly, q]
  );

  const browsing = activeCat === "all" && !q && !liveOnly;
  const liveTools = allTools.filter((t) => t.status === "live");
  const featured = liveTools[0];

  return (
    <div>
      {/* Compact sticky control — ~56px, hairline, not a second navbar card */}
      <div className="sticky top-[4.75rem] z-30 -mx-6 mb-10 border-b border-ink/8 bg-ivory/90 px-6 backdrop-blur-md md:top-[5.25rem]">
        <div className="flex h-14 items-center gap-4 md:gap-6">
          <label className="relative flex min-w-0 flex-1 items-center md:max-w-[240px]">
            <Search className="pointer-events-none absolute left-0 h-3.5 w-3.5 text-ink-faint" strokeWidth={1.6} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search engines…"
              className="w-full border-0 border-b border-transparent bg-transparent py-2 pl-6 pr-7 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-0 text-ink-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>

          <nav
            aria-label="Domains"
            className="hidden min-w-0 flex-1 items-center gap-x-4 overflow-x-auto text-[12px] md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <FilterText active={activeCat === "all"} onClick={() => setActiveCat("all")}>
              All
            </FilterText>
            {categories.map((c) => (
              <FilterText key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
                {c.name}
              </FilterText>
            ))}
          </nav>

          <button
            type="button"
            role="switch"
            aria-checked={liveOnly}
            onClick={() => setLiveOnly((v) => !v)}
            className={cn(
              "shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
              liveOnly ? "text-gold" : "text-ink-faint hover:text-ink"
            )}
          >
            <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", liveOnly ? "bg-gold" : "bg-ink/25")} />
            {liveOnly ? "Operational" : "All status"}
          </button>
        </div>

        {/* Mobile domain row */}
        <div className="flex gap-3 overflow-x-auto pb-3 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterText active={activeCat === "all"} onClick={() => setActiveCat("all")}>
            All
          </FilterText>
          {categories.map((c) => (
            <FilterText key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </FilterText>
          ))}
        </div>
      </div>

      {browsing ? (
        <div className="space-y-16 md:space-y-20">
          {/* Featured live tool — breaks the equal grid */}
          {featured ? (
            <FeaturedTool tool={featured} categoryName={featured.categoryName} />
          ) : null}

          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              hideSlug={featured?.slug}
            />
          ))}
        </div>
      ) : (
        <div>
          <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </p>
          {matches.length === 0 ? (
            <div className="py-16 text-center">
              <p className="technical mb-2 !text-ink-soft">No matching tools</p>
              <p className="mx-auto max-w-sm text-sm text-ink-mute">Try another term, or clear filters.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveCat("all");
                  setLiveOnly(false);
                }}
                className="mt-5 text-[13px] text-ink underline-offset-4 hover:underline"
              >
                Reset
              </button>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {matches.map((tool) => (
                  <motion.div
                    key={tool.slug}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                    className="border-t border-ink/8"
                  >
                    <ToolRow tool={tool} categoryLabel={tool.categoryName} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterText({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap transition-colors",
        active ? "text-ink" : "text-ink-faint hover:text-ink-mute"
      )}
    >
      <span className={cn(active && "underline decoration-gold decoration-1 underline-offset-[6px]")}>
        {children}
      </span>
    </button>
  );
}

function FeaturedTool({ tool, categoryName }: { tool: FlatTool; categoryName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Start here</p>
      <Link
        href={`/tools/${tool.slug}`}
        data-cursor="Open"
        className="group mt-3 grid gap-8 border-t border-ink/15 pt-6 md:grid-cols-[1.2fr_0.8fr] md:gap-12"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {categoryName} · {tool.engine}
          </p>
          <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.25rem)] font-light tracking-tight text-ink">
            {tool.name}
          </h2>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-mute">{tool.blurb}</p>
          <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-ink transition-colors group-hover:text-gold">
            Open tool
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </span>
        </div>
        <div className="flex flex-col justify-center border-l border-ink/8 pl-0 md:pl-8">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">Preview</p>
          <div className="min-h-[88px] transition-opacity duration-500 group-hover:opacity-100">
            <ToolPreview slug={tool.slug} live />
          </div>
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gold" />
            Operational
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

function CategorySection({
  category,
  hideSlug
}: {
  category: ExplorerCategory;
  hideSlug?: string;
}) {
  const tools = category.tools.filter((t) => t.slug !== hideSlug);
  const live = tools.filter((t) => t.status === "live");
  const documented = tools.filter((t) => t.status === "documented");
  const liveTotal = category.tools.filter((t) => t.status === "live").length;
  const mappedTotal = category.tools.filter((t) => t.status === "documented").length;

  if (live.length === 0 && documented.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] text-gold">
              {String(category.number).padStart(2, "0")}
            </span>
            <h2 className="text-xl font-light tracking-tight text-ink md:text-2xl">{category.name}</h2>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{category.summary}</p>
        </div>
        <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          {liveTotal} operational
          {mappedTotal > 0 ? ` · ${mappedTotal} mapped` : ""}
        </p>
      </div>

      {/* Live tools — asymmetric: first spans wider when odd count */}
      {live.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-10 border-t border-ink/10 sm:grid-cols-2">
          {live.map((tool, i) => (
            <div
              key={tool.slug}
              className={cn(
                "border-b border-ink/8",
                live.length % 2 === 1 && i === 0 && "sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-10"
              )}
            >
              <ToolRow tool={tool} featured={live.length % 2 === 1 && i === 0} />
            </div>
          ))}
        </div>
      ) : null}

      {/* Documented — compact text list, not dashed empty cards */}
      {documented.length > 0 ? (
        <ul className="mt-4 space-y-0 border-t border-ink/6 pt-1">
          {documented.map((tool) => (
            <li
              key={tool.slug}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/6 py-2.5"
            >
              <span className="text-[13px] text-ink-mute">{tool.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                {tool.engine} · on the roadmap
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </motion.section>
  );
}

function ToolRow({
  tool,
  categoryLabel,
  featured = false
}: {
  tool: ExplorerTool;
  categoryLabel?: string;
  featured?: boolean;
}) {
  const live = tool.status === "live";

  const body = (
    <article
      className={cn(
        "group/card flex h-full flex-col py-5 transition-colors",
        live && "hover:bg-pearl/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            {categoryLabel ? `${categoryLabel} · ` : ""}
            {tool.engine}
          </p>
          <h3
            className={cn(
              "mt-1.5 font-light tracking-tight text-ink",
              featured ? "text-lg md:text-xl" : "text-[15px] md:text-base"
            )}
          >
            {tool.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-mute">{tool.blurb}</p>
        </div>
        {live ? (
          <span className="mt-1 shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
            <span className="mr-1 inline-block h-1 w-1 rounded-full bg-gold" />
            Ops
          </span>
        ) : null}
      </div>

      <div className="mt-4 min-h-[64px] opacity-80 transition-opacity duration-400 group-hover/card:opacity-100">
        <ToolPreview slug={tool.slug} live={live} />
      </div>

      {live ? (
        <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink group-hover/card:text-gold">
          Open
          <span aria-hidden className="transition-transform duration-300 group-hover/card:translate-x-0.5">
            →
          </span>
        </span>
      ) : (
        <span className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">Mapped</span>
      )}
    </article>
  );

  if (!live) return body;

  return (
    <Link href={`/tools/${tool.slug}`} data-cursor="Open" className="block h-full px-0 sm:px-1">
      {body}
    </Link>
  );
}
