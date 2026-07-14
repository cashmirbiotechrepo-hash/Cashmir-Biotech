"use client";

import { motion } from "framer-motion";
import { Reveal, RevealText } from "@/components/ui/reveal";

const CAPABILITIES = [
  { index: "01", label: "Predictive Phytochemistry", note: "Model actives before extraction" },
  { index: "02", label: "Automated Isolation", note: "Cold-chain, low-oxygen synthesis" },
  { index: "03", label: "In-Assay Validation", note: "LC-MS on every batch" }
];

export function Platform() {
  return (
    <section id="platform" className="relative py-24 md:py-44">
      <div className="frame grid grid-cols-1 items-start gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Reveal>
            <p className="technical mb-6">The Method</p>
          </Reveal>
          <h2 className="text-[clamp(2rem,3.6vw,3.25rem)] font-light leading-[1.08] tracking-tightest">
            <RevealText
              text="A closed-loop discipline for molecular nutrition."
              accentWords={[5]}
            />
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-md leading-relaxed text-ink-mute">
              Cashmir Biotech pairs computational phytochemistry with high-integrity
              isolation, turning field research into registered formulations in seasons —
              not decades. Every experiment feeds the next.
            </p>
          </Reveal>

          <div className="mt-10 space-y-3">
            {CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.index} delay={0.08 * i}>
                <div className="group flex items-center gap-5 rounded-lg border border-ink/10 bg-paper/40 p-5 transition-colors duration-300 hover:border-gold/50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pearl font-mono text-[11px] text-ink transition-colors duration-300 group-hover:bg-gold/15">
                    {cap.index}
                  </span>
                  <span className="flex-1 text-sm tracking-wide text-ink-soft">{cap.label}</span>
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint sm:block">
                    {cap.note}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-28">
            <Reveal y={48}>
              <div className="relative flex flex-col items-center gap-12 py-8">
                <div className="relative flex h-72 w-72 items-center justify-center md:h-[26rem] md:w-[26rem]">
                  {/* Pulsing glow keeps the visual grounded without a hard box. */}
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute h-2/3 w-2/3 rounded-full bg-[radial-gradient(circle,rgba(111,168,206,0.18),transparent_70%)] blur-2xl"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
                  />

                  {/* Outer orbit — a gold node travels clockwise. */}
                  <motion.div
                    aria-hidden
                    className="absolute h-full w-full rounded-full border border-ink/10"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 26, ease: "linear", repeat: Infinity }}
                  >
                    <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_12px_rgba(199,164,112,0.8)]" />
                  </motion.div>

                  {/* Inner orbit — a sky node travels counter-clockwise. */}
                  <motion.div
                    aria-hidden
                    className="absolute h-2/3 w-2/3 rounded-full border border-sky/40"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 18, ease: "linear", repeat: Infinity }}
                  >
                    <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky shadow-[0_0_10px_rgba(111,168,206,0.8)]" />
                  </motion.div>

                  {/* Breathing core. */}
                  <motion.div
                    className="relative h-28 w-28 rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(255,255,255,0.95),rgba(169,201,222,0.4)_60%,transparent)] shadow-[0_20px_60px_rgba(111,168,206,0.35)]"
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
                  />
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                    Platform Architecture
                  </p>
                  <p className="mt-2 text-xl font-light tracking-tight text-ink">
                    Source → Isolate → Verify → Formulate
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
