import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/ui/reveal";
import { ToolRunner } from "@/components/tools/tool-runner";
import { findTool, LIVE_TOOLS } from "@/components/tools/catalog";

export function generateStaticParams() {
  return LIVE_TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = findTool(slug);
  if (!found) return { title: "Tool" };
  return { title: found.tool.name, description: found.tool.blurb };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = findTool(slug);
  if (!found || found.tool.status !== "live") notFound();
  const { tool, category } = found;

  return (
    <div className="pb-16">
      <header className="frame relative pb-12 pt-36 md:pt-44">
        <Reveal>
          <Link
            href="/tools"
            data-cursor="Back"
            className="mb-8 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> Bioinformatics Suite
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-gold/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
              {tool.engine}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {category.name}
            </span>
          </div>
        </Reveal>
        <h1 className="mt-6 max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[1.04] tracking-tightest">
          {tool.name}
        </h1>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-mute">{tool.blurb}</p>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">When to use: </span>
            {tool.whenToUse}
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            <div>
              <dt className="inline text-ink-faint">Level </dt>
              <dd className="inline text-ink-mute">
                {tool.difficulty === "beginner"
                  ? "Beginner"
                  : tool.difficulty === "intermediate"
                    ? "Intermediate"
                    : "Advanced"}
              </dd>
            </div>
            <div>
              <dt className="inline">Input </dt>
              <dd className="inline text-ink-mute">{tool.input}</dd>
            </div>
            <div>
              <dt className="inline">Output </dt>
              <dd className="inline text-ink-mute">{tool.output}</dd>
            </div>
            <div>
              <dt className="inline">Runtime </dt>
              <dd className="inline text-ink-mute">{tool.runtime}</dd>
            </div>
          </dl>
        </Reveal>
        <div className="hairline-x mt-12 h-px w-full" />
      </header>

      <section className="frame">
        <ToolRunner tool={tool} />
      </section>
    </div>
  );
}
