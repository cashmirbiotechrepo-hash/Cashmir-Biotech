import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { TechChip } from "@/components/ui/tech-chip";
import { LuxeButton } from "@/components/ui/luxe-button";
import { ToolsExplorer, type ExplorerCategory } from "@/components/tools/tools-explorer";
import {
  ENGINE_COUNT,
  LIVE_TOOL_COUNT,
  TOOL_CATEGORIES,
  TOTAL_TOOL_COUNT
} from "@/components/tools/catalog";

export const metadata: Metadata = {
  title: "Bioinformatics Suite",
  description:
    "A rigor-first bioinformatics toolkit — sequence analysis, alignment, primer design, protein and structural biology — built on published algorithms, not gimmicks."
};

const EXPLORER_CATEGORIES: ExplorerCategory[] = TOOL_CATEGORIES.map((c) => ({
  id: c.id,
  number: c.number,
  name: c.name,
  summary: c.summary,
  tools: c.tools.map((t) => ({
    slug: t.slug,
    name: t.name,
    blurb: t.blurb,
    engine: t.engine,
    status: t.status
  }))
}));

export default function ToolsPage() {
  return (
    <div className="pb-20">
      {/* Tall hero — own the first viewport before the catalogue */}
      <header className="frame relative flex min-h-[min(92vh,820px)] flex-col justify-end pb-10 pt-32 md:pb-14 md:pt-40">
        <Reveal>
          <TechChip className="mb-5 !text-ink-soft">Bioinformatics Suite</TechChip>
        </Reveal>
        <h1 className="max-w-[14ch] text-[clamp(2.6rem,6.5vw,5rem)] font-light leading-[0.98] tracking-tightest [&_.text-gold]:font-light [&_.text-gold]:text-gold/80">
          <RevealText text="Real algorithms for real biology." accentWords={[1]} />
        </h1>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-mute">
            Peer-reviewed engines — SantaLucia thermodynamics, Needleman–Wunsch &amp; Smith–Waterman,
            Karlin–Altschul statistics. Paste a sequence. Get a real answer.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <LuxeButton href="#catalogue" magnetic={false}>
              Open the suite
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            </LuxeButton>
            <Link
              href="#catalogue"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute underline-offset-4 hover:text-ink hover:underline"
            >
              {LIVE_TOOL_COUNT} operational · scroll
            </Link>
          </div>
        </Reveal>

        {/* Asymmetric credibility — not equal boxes */}
        <Reveal delay={0.18}>
          <div className="mt-14 flex flex-wrap items-end gap-x-10 gap-y-6 border-t border-ink/10 pt-7 md:gap-x-14">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Operational</p>
              <p className="mt-1 text-[2.75rem] font-light leading-none tracking-tight text-ink">
                {LIVE_TOOL_COUNT}
              </p>
              <p className="mt-1 text-[12px] text-ink-mute">live algorithms</p>
            </div>
            <div className="hidden h-12 w-px bg-ink/10 sm:block" aria-hidden />
            <div>
              <p className="text-2xl font-light tracking-tight text-ink">{ENGINE_COUNT}</p>
              <p className="mt-1 text-[12px] text-ink-mute">core engines</p>
            </div>
            <div>
              <p className="text-2xl font-light tracking-tight text-ink">{TOOL_CATEGORIES.length}</p>
              <p className="mt-1 text-[12px] text-ink-mute">scientific domains</p>
            </div>
            <div className="sm:ml-auto sm:text-right">
              <p className="text-lg font-light tracking-tight text-ink-soft">{TOTAL_TOOL_COUNT}+</p>
              <p className="mt-1 text-[12px] text-ink-faint">mapped in the suite</p>
            </div>
          </div>
        </Reveal>

        <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block" aria-hidden>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">Scroll</span>
        </div>
      </header>

      <section id="catalogue" className="frame scroll-mt-28 border-t border-ink/8 pt-10 md:pt-12">
        <ToolsExplorer categories={EXPLORER_CATEGORIES} />
      </section>
    </div>
  );
}
