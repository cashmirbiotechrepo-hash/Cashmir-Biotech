import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { TechChip } from "@/components/ui/tech-chip";
import { LuxeButton } from "@/components/ui/luxe-button";
import { ToolsExplorer } from "@/components/tools/tools-explorer";
import {
  ENGINE_COUNT,
  LIVE_TOOL_COUNT,
  POPULAR_TOOLS,
  RECOMMENDED_PATH,
  TOOL_CATEGORIES,
  TOTAL_TOOL_COUNT
} from "@/components/tools/catalog";

export const metadata: Metadata = {
  title: "Bioinformatics Suite",
  description:
    "A rigor-first bioinformatics toolkit — sequence analysis, alignment, primer design, protein and structural biology — built on published algorithms, not gimmicks."
};

export default function ToolsPage() {
  return (
    <div className="pb-20">
      <header className="frame relative pb-10 pt-32 md:pb-12 md:pt-40">
        <div className="grid min-h-[min(68vh,620px)] items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.7fr)] lg:gap-14">
          <div className="flex flex-col justify-end">
            <Reveal>
              <TechChip className="mb-5 !text-ink-soft">Bioinformatics Suite</TechChip>
            </Reveal>
            <h1 className="max-w-[16ch] text-[clamp(2.4rem,5.5vw,4.25rem)] font-light leading-[0.98] tracking-tightest [&_.text-gold]:font-light [&_.text-gold]:text-gold/80">
              <RevealText text="Real algorithms for real biology." accentWords={[1]} />
            </h1>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-mute">
                {LIVE_TOOL_COUNT} operational engines now — paste a sequence, get a published algorithm
                answer. Start with a task, follow the beginner path, or filter the suite.
              </p>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <LuxeButton href="#suite-control" magnetic={false}>
                  Browse the suite
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                </LuxeButton>
                <Link
                  href="/tools/sequence-composition"
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute underline-offset-4 hover:text-ink hover:underline"
                >
                  Start with Composition →
                </Link>
                <Link
                  href="/tools/blast"
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute underline-offset-4 hover:text-ink hover:underline"
                >
                  Open BLAST →
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Customer Portal — tools hero only (not in global header) */}
          <Reveal delay={0.16}>
            <aside className="border border-ink/12 bg-pearl/40 p-6 md:p-7 lg:self-end">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Customer Portal</p>
              <h2 className="mt-2 text-xl font-light tracking-tight text-ink md:text-2xl">
                Orders, invoices &amp; CoAs
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">
                Sign in with your checkout email for order history, GST invoices, lot certificates, organisation
                seats, and Research Circle — separate from this public suite.
              </p>
              <Link
                href="/portal/login"
                data-cursor="Account"
                className="group mt-6 inline-flex items-center gap-2 border-b border-ink/25 pb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink transition-colors hover:border-gold hover:text-gold"
              >
                Open account
                <ArrowUpRight
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  strokeWidth={1.6}
                />
              </Link>
            </aside>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-wrap items-end gap-x-10 gap-y-5 border-t border-ink/10 pt-6 md:gap-x-14">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Operational</p>
              <p className="mt-1 text-[2.5rem] font-light leading-none tracking-tight text-ink">
                {LIVE_TOOL_COUNT}
              </p>
              <p className="mt-1 text-[12px] text-ink-mute">live algorithms</p>
            </div>
            <div className="hidden h-12 w-px bg-ink/10 sm:block" aria-hidden />
            <div>
              <p className="text-2xl font-light tracking-tight text-ink">{TOOL_CATEGORIES.length}</p>
              <p className="mt-1 text-[12px] text-ink-mute">domains</p>
            </div>
            <div>
              <p className="text-2xl font-light tracking-tight text-ink">{ENGINE_COUNT}</p>
              <p className="mt-1 text-[12px] text-ink-mute">core engines</p>
            </div>
            <div className="sm:ml-auto sm:text-right">
              <p className="text-lg font-light tracking-tight text-ink-soft">{TOTAL_TOOL_COUNT}+</p>
              <p className="mt-1 text-[12px] text-ink-faint">mapped in the suite</p>
            </div>
          </div>
        </Reveal>
      </header>

      <section className="frame border-t border-ink/8 pt-12 md:pt-14">
        <ToolsExplorer
          categories={TOOL_CATEGORIES}
          recommended={RECOMMENDED_PATH}
          popular={POPULAR_TOOLS}
        />
      </section>
    </div>
  );
}
