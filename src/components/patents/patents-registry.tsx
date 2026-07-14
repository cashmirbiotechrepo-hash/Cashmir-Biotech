"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { cn } from "@/lib/utils";

export type RegistryPatent = {
  id: string;
  patentCode: string;
  title: string;
  summary: string;
  status: string;
  lifecycleStatus: string;
  jurisdiction: string;
  imageUrl: string;
  year: number;
  linkedProduct?: { name: string; slug: string } | null;
};

type Props = {
  patents: RegistryPatent[];
  years: number[];
  jurisdictions: string[];
};

function oneLiner(summary: string) {
  const cut = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;
  return cut.length > 140 ? `${cut.slice(0, 137)}…` : cut;
}

function StatusBadge({ status, lifecycle }: { status: string; lifecycle: string }) {
  const label = (lifecycle || status || "filed").replace(/_/g, " ");
  const key = label.toLowerCase();
  const tone =
    key.includes("grant") || key.includes("registered")
      ? "text-gold bg-gold/10"
      :                     key.includes("pend") || key.includes("filed")
        ? "text-sky bg-sky/20"
        : key.includes("design") || key.includes("trademark") || key.includes("utility")
          ? "text-ink-soft bg-ink/5"
          : "text-ink-mute bg-pearl";

  return (
    <span className={cn("inline-block px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]", tone)}>
      {label}
    </span>
  );
}

function PatentCard({
  patent,
  layout
}: {
  patent: RegistryPatent;
  layout: "featured" | "standard" | "compact" | "wide";
}) {
  const line = oneLiner(patent.summary);

  if (layout === "featured") {
    return (
      <article className="group relative grid gap-6 border-t border-ink/15 bg-paper py-8 transition-colors md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10 md:py-10">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden bg-pearl grayscale-[0.35] transition-[filter] duration-700 group-hover:grayscale-0 md:mx-0 md:max-w-none">
          {patent.imageUrl ? (
            <Image
              src={patent.imageUrl}
              alt=""
              fill
              sizes="280px"
              className="object-contain object-top p-3 transition-transform duration-700 ease-expo group-hover:scale-[1.02]"
            />
          ) : null}
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Flagship IP</p>
            <StatusBadge status={patent.status} lifecycle={patent.lifecycleStatus} />
          </div>
          <h2 className="mt-3 max-w-xl text-[clamp(1.4rem,2.8vw,2rem)] font-light leading-snug tracking-tight text-ink">
            {patent.title}
          </h2>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-ink-mute">{line}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Number", v: patent.patentCode },
              { k: "Jurisdiction", v: patent.jurisdiction },
              { k: "Year", v: String(patent.year) },
              { k: "Status", v: patent.lifecycleStatus || patent.status }
            ].map((m) => (
              <div key={m.k} className="border-t border-ink/10 pt-2">
                <dt className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faint">{m.k}</dt>
                <dd className="mt-0.5 truncate text-[12px] text-ink">{m.v}</dd>
              </div>
            ))}
          </dl>
          {patent.linkedProduct ? (
            <Link
              href={`/products/${patent.linkedProduct.slug}`}
              className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-ink underline-offset-4 hover:underline"
            >
              Commercialised as {patent.linkedProduct.name}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Research milestone
            </p>
          )}
        </div>
      </article>
    );
  }

  if (layout === "compact") {
    return (
      <article className="group flex h-full flex-col border-t border-ink/10 py-5 transition-colors hover:bg-pearl/40">
        <div className="flex items-start justify-between gap-3">
          <StatusBadge status={patent.status} lifecycle={patent.lifecycleStatus} />
          <span className="font-mono text-[10px] text-ink-faint">{patent.year}</span>
        </div>
        <h3 className="mt-2 text-[15px] font-light leading-snug tracking-tight text-ink">{patent.title}</h3>
        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-ink-mute">{line}</p>
        <p className="mt-auto pt-3 font-mono text-[10px] text-ink-faint">
          {patent.patentCode} · {patent.jurisdiction}
        </p>
      </article>
    );
  }

  if (layout === "wide") {
    return (
      <article className="group grid gap-5 border-t border-ink/10 py-6 transition-colors hover:bg-pearl/30 sm:grid-cols-[5.5rem_1fr] sm:items-start">
        <div className="relative hidden aspect-square overflow-hidden bg-pearl grayscale-[0.4] transition-[filter] duration-500 group-hover:grayscale-0 sm:block">
          {patent.imageUrl ? (
            <Image src={patent.imageUrl} alt="" fill sizes="88px" className="object-cover object-top" />
          ) : null}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={patent.status} lifecycle={patent.lifecycleStatus} />
            <span className="font-mono text-[10px] text-gold">{patent.patentCode}</span>
          </div>
          <h3 className="mt-2 text-lg font-light leading-snug tracking-tight text-ink">{patent.title}</h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-mute">{line}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            <span>{patent.jurisdiction}</span>
            <span>{patent.year}</span>
            {patent.linkedProduct ? <span className="text-gold">→ {patent.linkedProduct.name}</span> : null}
          </div>
        </div>
      </article>
    );
  }

  // standard
  return (
    <article className="group flex h-full flex-col border-t border-ink/10 pt-5 transition-colors hover:bg-pearl/35">
      <div className="relative mb-4 aspect-[16/10] w-full max-w-[140px] overflow-hidden bg-pearl grayscale-[0.45] transition-[filter] duration-500 group-hover:grayscale-0">
        {patent.imageUrl ? (
          <Image
            src={patent.imageUrl}
            alt=""
            fill
            sizes="140px"
            className="object-contain object-top p-2 transition-transform duration-700 ease-expo group-hover:scale-[1.03]"
          />
        ) : null}
      </div>
      <StatusBadge status={patent.status} lifecycle={patent.lifecycleStatus} />
      <h3 className="mt-2 text-base font-light leading-snug tracking-tight text-ink">{patent.title}</h3>
      <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-snug text-ink-mute">{line}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-ink/8 pt-3">
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">No.</dt>
          <dd className="truncate text-[11px] text-ink">{patent.patentCode}</dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">Where</dt>
          <dd className="text-[11px] text-ink">{patent.jurisdiction}</dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">Year</dt>
          <dd className="text-[11px] text-ink">{patent.year}</dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">Status</dt>
          <dd className="truncate text-[11px] capitalize text-ink">{patent.lifecycleStatus || patent.status}</dd>
        </div>
      </dl>
    </article>
  );
}

function layoutForIndex(i: number): "featured" | "standard" | "compact" | "wide" {
  if (i === 0) return "featured";
  if (i % 5 === 0) return "wide";
  if (i % 3 === 0) return "compact";
  return "standard";
}

export function PatentsRegistry({ patents, years, jurisdictions }: Props) {
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [placeFilter, setPlaceFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return patents.filter((p) => {
      if (yearFilter !== "all" && p.year !== yearFilter) return false;
      if (placeFilter !== "all" && p.jurisdiction !== placeFilter) return false;
      return true;
    });
  }, [patents, yearFilter, placeFilter]);

  const [featured] = filtered;
  const byYear = useMemo(() => {
    const map = new Map<number, RegistryPatent[]>();
    for (const p of filtered) {
      const list = map.get(p.year) ?? [];
      list.push(p);
      map.set(p.year, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <div>
      {/* Soft category / filter — text, not pills */}
      <div className="mb-8 flex flex-col gap-4 border-b border-ink/8 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">Browse</p>
          <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <button
              type="button"
              onClick={() => setPlaceFilter("all")}
              className={cn(placeFilter === "all" ? "text-ink underline decoration-gold underline-offset-4" : "text-ink-faint hover:text-ink")}
            >
              All jurisdictions
            </button>
            {jurisdictions.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setPlaceFilter(j)}
                className={cn(placeFilter === j ? "text-ink underline decoration-gold underline-offset-4" : "text-ink-faint hover:text-ink")}
              >
                {j}
              </button>
            ))}
          </nav>
        </div>
        <nav className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint">
          <button
            type="button"
            onClick={() => setYearFilter("all")}
            className={cn(yearFilter === "all" ? "text-gold" : "hover:text-ink")}
          >
            All years
          </button>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYearFilter(y)}
              className={cn(yearFilter === y ? "text-gold" : "hover:text-ink")}
            >
              {y}
            </button>
          ))}
        </nav>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-mute">No patents match these filters.</p>
      ) : (
        <>
          {featured ? <PatentCard patent={featured} layout="featured" /> : null}

          {/* Chronology spine */}
          <div className="mt-12 border-t border-ink/10 pt-8">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Innovation timeline</p>
            <ol className="mt-6 space-y-10">
              {byYear.map(([year, items], yi) => (
                <motion.li
                  key={year}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                  transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.04 * yi }}
                  className="grid gap-6 md:grid-cols-[4.5rem_1fr] md:gap-10"
                >
                  <div>
                    <p className="text-2xl font-light tracking-tight text-ink">{year}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                      {items.length} filing{items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "grid gap-x-8 gap-y-0",
                      items.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"
                    )}
                  >
                    {items.map((patent, i) => {
                      // Skip if it's the same as global featured and only item showing duplicate - featured already shown
                      if (featured && patent.id === featured.id && yearFilter === "all" && placeFilter === "all") {
                        // Still show in timeline as compact reference? Skip full card duplicate
                        return (
                          <p key={patent.id} className="border-t border-ink/8 py-4 text-[13px] text-ink-mute">
                            <span className="font-mono text-[10px] text-gold">Flagship · </span>
                            {patent.title}
                          </p>
                        );
                      }
                      const layout = layoutForIndex(i + 1);
                      return (
                        <PatentCard
                          key={patent.id}
                          patent={patent}
                          layout={layout === "featured" ? "wide" : layout}
                        />
                      );
                    })}
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
