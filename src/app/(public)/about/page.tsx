import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { CERTIFICATIONS, IP_PORTFOLIO_STATS } from "@/data/certifications";
import { LuxeButton } from "@/components/ui/luxe-button";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "Cashmir Biotech — a SKUAST-K aligned biotechnology company from Kashmir, backed by patents, certifications, and regulatory compliance."
};

export default function AboutPage() {
  return (
    <div className="pb-8">
      <PageHeader
        eyebrow="About Cashmir"
        title="Science, certification, and Kashmir biodiversity."
        accentWords={[2, 4]}
        description="Cashmir Biotech Pvt Ltd translates faculty–student research from SKUAST-K into patent-backed functional foods and supplements — manufactured under FSSAI licence with full regulatory documentation."
      />

      <section className="frame mb-24">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {IP_PORTFOLIO_STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={0.05 * i}>
              <div className="rounded-2xl border border-ink/10 bg-paper/60 p-6 text-center">
                <p className="text-3xl font-light tracking-tight text-ink">{stat.value}</p>
                <p className="technical mt-3 !text-[9px]">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-ink-mute">
            Our intellectual property portfolio spans granted Indian patents, inventorship
            certificates, a registered industrial design, trademark protection, and an
            international German utility model — documenting innovation across agriculture,
            nutraceuticals, diagnostics, and oncology research.
          </p>
        </Reveal>
      </section>

      <section className="frame">
        <Reveal>
          <p className="technical mb-5">Regulatory & Startup Credentials</p>
          <h2 className="mb-12 max-w-xl text-[clamp(1.8rem,4vw,2.75rem)] font-light leading-[1.08] tracking-tightest">
            Demonstrating quality, innovation, and compliance.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {CERTIFICATIONS.map((cert, i) => (
            <Reveal key={cert.id} delay={0.06 * (i % 3)} y={40}>
              <article className="group overflow-hidden rounded-2xl border border-ink/10 bg-paper/70 shadow-glass">
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-ivory p-4">
                  <Image
                    src={cert.imageUrl}
                    alt={cert.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-contain transition-transform duration-700 ease-expo group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-light tracking-tight text-ink">{cert.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-mute">{cert.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-4">
            <LuxeButton href="/patents">Explore the patent registry</LuxeButton>
            <LuxeButton href="/contact" variant="ghost">
              Get in touch
            </LuxeButton>
          </div>
        </Reveal>
      </section>

      <section className="frame mt-24 rounded-2xl border border-ink/10 bg-ivory p-8 md:p-12">
        <Reveal>
          <p className="technical mb-4">Legal</p>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-mute">
            We are committed to protecting your privacy under the Digital Personal Data
            Protection Act, 2023. For full policy details including returns and terms, please
            contact us — formal policy pages are being published alongside our expanded site.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-gold transition-colors hover:text-ink"
          >
            Request policy documents →
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
