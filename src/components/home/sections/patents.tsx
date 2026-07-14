"use client";

import Link from "next/link";
import { Reveal, RevealText } from "@/components/ui/reveal";
import type { PatentCard } from "@/components/home/content";

export function Patents({ patents }: { patents: PatentCard[] }) {
  return (
    <section id="patents" className="relative py-24 md:py-44">
      <div className="hairline-x absolute inset-x-0 top-0 h-px" />
      <div className="frame grid grid-cols-1 gap-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <Reveal>
              <p className="technical mb-5">Registry</p>
            </Reveal>
            <h2 className="text-[clamp(2rem,3.4vw,3rem)] font-light leading-[1.08] tracking-tightest">
              <RevealText text="Protected by patent, proven by research." accentWords={[2, 5]} />
            </h2>
            <Reveal delay={0.1}>
              <Link
                href="/patents"
                data-cursor="Open"
                className="group mt-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute transition-colors hover:text-ink"
              >
                Explore the registry
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </Reveal>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {patents.map((patent) => (
              <Reveal key={patent.id}>
                <article className="group grid grid-cols-1 gap-4 py-8 transition-colors md:grid-cols-[auto_1fr_auto] md:items-start md:gap-8">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
                    {patent.patentCode}
                  </div>
                  <div>
                    <h3 className="text-xl font-light tracking-tight text-ink">{patent.title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-mute">
                      {patent.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-1">
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                      {patent.status}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      {patent.jurisdiction} · {patent.year}
                    </span>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
