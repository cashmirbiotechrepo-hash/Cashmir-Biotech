import { Reveal, RevealText } from "@/components/ui/reveal";
import { TechChip } from "@/components/ui/tech-chip";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  accentWords?: number[];
  description?: string;
};

/** Consistent editorial header for interior public pages (clears the nav). */
export function PageHeader({ eyebrow, title, accentWords = [], description }: PageHeaderProps) {
  return (
    <header className="frame relative pb-16 pt-36 md:pb-20 md:pt-44">
      <Reveal>
        <div className="mb-7">
          <TechChip>{eyebrow}</TechChip>
        </div>
      </Reveal>
      <h1 className="max-w-3xl text-[clamp(2.4rem,5.5vw,4.5rem)] font-light leading-[1.02] tracking-tightest">
        <RevealText text={title} accentWords={accentWords} />
      </h1>
      {description ? (
        <Reveal delay={0.1}>
          <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-ink-mute">{description}</p>
        </Reveal>
      ) : null}
      <div className="hairline-x mt-14 h-px w-full" />
    </header>
  );
}
