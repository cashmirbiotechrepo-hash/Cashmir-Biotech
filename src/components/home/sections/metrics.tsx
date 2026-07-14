"use client";

import { Reveal, RevealText } from "@/components/ui/reveal";
import { TiltCard } from "@/components/ui/tilt-card";
import { Counter } from "@/components/ui/counter";
import type { HomeContent } from "@/components/home/content";

export function Metrics({ metrics }: { metrics: HomeContent["metrics"] }) {
  return (
    <section id="science" className="relative overflow-hidden py-24 md:py-44">
      <div className="hairline-x absolute inset-x-0 top-0 h-px" />
      <div className="frame">
        <div className="mb-20 text-center md:mb-28">
          <Reveal>
            <p className="technical mb-5">Scientific Rigor</p>
          </Reveal>
          <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-light tracking-tightest">
            <RevealText text="Numbers held to evidence." accentWords={[2]} />
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {metrics.map((metric, i) => (
            <Reveal key={metric.label} delay={0.1 * i} y={48}>
              <TiltCard
                className="group h-full rounded-2xl border border-ink/10 bg-paper/70 p-10 shadow-glass backdrop-blur-md md:p-12"
                max={9}
              >
                <div className="flex items-baseline text-6xl font-light tracking-tightest text-ink md:text-7xl">
                  <Counter value={metric.value} decimals={metric.decimals ?? 0} />
                  {metric.suffix ? (
                    <span className="ml-1 text-3xl text-gold">{metric.suffix}</span>
                  ) : null}
                </div>
                <div className="my-6 h-px w-10 bg-gold/60" />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  {metric.label}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-mute">{metric.note}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
