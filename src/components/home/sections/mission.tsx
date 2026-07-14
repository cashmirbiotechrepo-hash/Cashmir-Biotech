"use client";

import { Reveal } from "@/components/ui/reveal";

export function Mission({ statement }: { statement: string }) {
  return (
    <section className="relative py-28 md:py-52">
      <div className="frame max-w-4xl text-center">
        <Reveal>
          <svg
            className="mx-auto mb-10 opacity-40"
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M7 7h5v5c0 3-2 5-5 5v-2c1.5 0 3-1 3-3H7V7zm9 0h5v5c0 3-2 5-5 5v-2c1.5 0 3-1 3-3h-3V7z" />
          </svg>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="text-balance text-[clamp(1.6rem,3.4vw,2.75rem)] font-light leading-[1.2] tracking-tight text-ink">
            {statement}
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="technical mt-10">Cashmir Biotech · Kashmir, India</p>
        </Reveal>
      </div>
    </section>
  );
}
