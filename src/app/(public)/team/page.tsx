import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { listPatents, listTeamMembers } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { TechChip } from "@/components/ui/tech-chip";
import type { TeamMember } from "@prisma/client";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Scientific Board",
  description:
    "The scientists and formulators behind Cashmir Biotech — faculty–student innovation translating Himalayan biodiversity into clinical-grade nutrition."
};

const EXPERTISE = [
  "Plant Biotechnology",
  "Phytochemistry",
  "Functional Foods",
  "Molecular Biology",
  "Nutraceutical Formulation",
  "Intellectual Property",
  "Analytical Chemistry",
  "Himalayan Biodiversity"
] as const;

const MILESTONES = [
  { year: "2020", event: "Research intensifies at SKUAST-K" },
  { year: "2021", event: "TaxO pathway characterised" },
  { year: "2022", event: "Cashmir Biotech incorporated" },
  { year: "2023", event: "IP filings accelerate" },
  { year: "2024", event: "Assay & clinical labeling" },
  { year: "2025", event: "Commercial formulations" }
] as const;

/** Curated credibility chips — surfaces authority the long bio buries. */
function credibilityFor(member: TeamMember): string[] {
  const role = member.role.toLowerCase();
  const name = member.fullName.toLowerCase();

  if (name.includes("khalid") || role.includes("founder")) {
    return ["SKUAST-K", "Plant Biotechnology", "Founder · 2022", "TaxO / Magic Food", "IP pipeline"];
  }
  if (name.includes("aqib") || (role.includes("director") && !role.includes("founder"))) {
    return ["Co-founder", "SKUAST-K MSc", "Operations", "Faculty–student model"];
  }
  if (role.includes("product") || role.includes("scientific")) {
    return ["Product science", "Formulation", "Regulatory readiness", "Magic Food"];
  }
  if (role.includes("marketing")) {
    return ["Brand", "Market access", "Campaigns", "Distribution"];
  }
  return [member.role];
}

function shortBio(bio: string, max = 160) {
  const first = bio.split(/(?<=[.!?])\s+/)[0] ?? bio;
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

function isFounder(m: TeamMember) {
  return /founder/i.test(m.role) || /khalid/i.test(m.fullName);
}

function isLeadership(m: TeamMember) {
  return /director/i.test(m.role) && !isFounder(m);
}

function Portrait({
  member,
  size = "md"
}: {
  member: TeamMember;
  size?: "lg" | "md" | "sm";
}) {
  const dims =
    size === "lg"
      ? "aspect-[4/5] w-full max-w-[320px]"
      : size === "sm"
        ? "aspect-square w-20"
        : "aspect-[4/5] w-full max-w-[160px]";

  return (
    <div className={`relative overflow-hidden bg-pearl ${dims}`}>
      {member.avatarUrl?.trim() ? (
        <Image
          src={member.avatarUrl}
          alt={member.fullName}
          fill
          sizes={size === "lg" ? "320px" : size === "sm" ? "80px" : "160px"}
          className="object-cover object-top grayscale contrast-[1.05] transition-[filter] duration-700 group-hover:grayscale-[0.35]"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-mist to-pearl"
          aria-hidden
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {member.fullName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </span>
        </div>
      )}
    </div>
  );
}

export default async function TeamPage() {
  let team: TeamMember[] = [];
  let patentCount = 0;

  try {
    const [members, patents] = await Promise.all([
      listTeamMembers(),
      listPatents().catch(() => [])
    ]);
    team = members;
    patentCount = patents.length;
  } catch (error) {
    logger.error({ err: error }, "Failed to load team members");
  }

  const founder = team.find(isFounder) ?? team[0] ?? null;
  const leadership = team.filter((m) => m.id !== founder?.id && isLeadership(m));
  const rest = team.filter(
    (m) => m.id !== founder?.id && !leadership.some((l) => l.id === m.id)
  );

  return (
    <div className="pb-16">
      {/* Hero + institutional metrics */}
      <header className="frame relative pb-8 pt-28 md:pb-10 md:pt-32">
        <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Reveal>
              <TechChip className="mb-4 !text-ink-soft">The Board</TechChip>
            </Reveal>
            <h1 className="max-w-[16ch] text-[clamp(2.2rem,5vw,3.75rem)] font-light leading-[1.04] tracking-tightest [&_.text-gold]:font-light [&_.text-gold]:text-gold/80">
              <RevealText text="The people behind the precision." accentWords={[2]} />
            </h1>
            <Reveal delay={0.08}>
              <p className="mt-5 max-w-md text-[14px] leading-relaxed text-ink-mute">
                Why this team exists — faculty and former students turning Himalayan flora into
                assayed, patent-backed nutrition.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-l border-ink/10 pl-6 md:pl-8">
              {[
                { k: "Incorporated", v: "2022" },
                { k: "Patents", v: String(patentCount || "—") },
                { k: "On the board", v: String(team.length || "—") },
                { k: "Affiliation", v: "SKUAST-K" }
              ].map((s) => (
                <div key={s.k}>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">{s.k}</dt>
                  <dd className="mt-0.5 text-xl font-light tracking-tight text-ink">{s.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </header>

      {/* Founder — editorial feature, not a grid card */}
      {founder ? (
        <section className="frame border-t border-ink/8 py-10 md:py-14">
          <Reveal>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Founder</p>
          </Reveal>
          <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
            <Reveal y={24} className="group">
              <Portrait member={founder} size="lg" />
            </Reveal>
            <Reveal delay={0.06} y={20}>
              <h2 className="text-[clamp(1.6rem,3vw,2.35rem)] font-light tracking-tight text-ink">
                {founder.fullName}
              </h2>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
                {founder.role}
              </p>
              <p className="mt-5 max-w-xl text-[15px] font-light leading-relaxed text-ink">
                {shortBio(founder.bio, 220)}
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {credibilityFor(founder).map((tag) => (
                  <li
                    key={tag}
                    className="border-b border-ink/15 pb-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <blockquote className="mt-8 max-w-md border-l border-gold/50 pl-4 text-[14px] leading-relaxed text-ink-mute">
                Leverage Kashmir&apos;s biodiversity to bridge traditional knowledge and modern
                biotechnology — advancing local development and global health.
              </blockquote>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* Leadership */}
      {leadership.length > 0 ? (
        <section className="frame border-t border-ink/8 py-10 md:py-12">
          <Reveal>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Leadership</p>
            <h2 className="mt-1 text-xl font-light tracking-tight text-ink">Directors</h2>
          </Reveal>
          <div className="mt-8 space-y-0">
            {leadership.map((member, i) => (
              <Reveal key={member.id} delay={0.04 * i} y={18}>
                <article className="group grid gap-5 border-t border-ink/10 py-7 sm:grid-cols-[140px_1fr] sm:gap-8">
                  <Portrait member={member} size="md" />
                  <div>
                    <h3 className="text-lg font-light tracking-tight text-ink">{member.fullName}</h3>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                      {member.role}
                    </p>
                    <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-mute">
                      {shortBio(member.bio)}
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                      {credibilityFor(member).map((tag) => (
                        <li key={tag} className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* Scientific / operational — compact */}
      {rest.length > 0 ? (
        <section className="frame border-t border-ink/8 py-10 md:py-12">
          <Reveal>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Team</p>
            <h2 className="mt-1 text-xl font-light tracking-tight text-ink">Scientific &amp; commercial</h2>
          </Reveal>
          <div className="mt-6 grid gap-x-10 gap-y-0 sm:grid-cols-2">
            {rest.map((member, i) => (
              <Reveal key={member.id} delay={0.04 * i}>
                <article className="group flex gap-4 border-t border-ink/10 py-5">
                  <Portrait member={member} size="sm" />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-light tracking-tight text-ink">{member.fullName}</h3>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                      {member.role}
                    </p>
                    <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-ink-mute">
                      {shortBio(member.bio, 120)}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {team.length === 0 ? (
        <section className="frame py-16 text-center">
          <p className="technical mb-2 !text-ink-soft">Profiles forthcoming</p>
          <p className="mx-auto max-w-md text-sm text-ink-mute">
            The board registry is being prepared for publication.
          </p>
        </section>
      ) : null}

      {/* Company journey */}
      <section className="frame border-t border-ink/8 py-10 md:py-12">
        <Reveal>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">How we got here</p>
          <h2 className="mt-1 text-xl font-light tracking-tight text-ink">A brief chronicle</h2>
        </Reveal>
        <ol className="mt-8 max-w-2xl">
          {MILESTONES.map((m, i) => (
            <Reveal key={m.year} delay={0.03 * i}>
              <li className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-ink/8 py-3.5">
                <span className="font-mono text-[12px] text-gold">{m.year}</span>
                <span className="text-[14px] text-ink-mute">{m.event}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Faculty–student — editorial, favorite unique section */}
      <section className="frame border-t border-ink/8 py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">
                Faculty–student model
              </p>
              <p className="mt-4 text-[clamp(1.35rem,2.6vw,1.85rem)] font-light leading-snug tracking-tight text-ink">
                A rare partnership between faculty and former students — not a corporate org chart.
              </p>
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <Reveal delay={0.05}>
              <p className="max-w-xl text-[14px] leading-relaxed text-ink-mute">
                Incorporated 19 September 2022 under Make in India, Innovate India, and Self-Reliant
                India — built between Dr. Khalid Z. Masoodi and former MSc student Aqib Ahmad Hurra at
                SKUAST-K.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {[
                {
                  label: "Institution",
                  title: "SKUAST-K",
                  body: "Division of Plant Biotechnology, Faculty of Horticulture.",
                  href: "/about"
                },
                {
                  label: "Flagship",
                  title: "Magic Food TaxO",
                  body: "Anticancer nutrition from underutilised Kashmiri flora.",
                  href: "/products"
                },
                {
                  label: "Proof",
                  title: "Patent register",
                  body: "Compositions, devices, and international filings.",
                  href: "/patents"
                }
              ].map((mod, i) => (
                <Reveal key={mod.label} delay={0.06 * i}>
                  <Link
                    href={mod.href}
                    className="group block border-t border-ink/10 pt-4 transition-colors hover:border-gold/40"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                      {mod.label}
                    </p>
                    <p className="mt-2 text-[15px] font-light tracking-tight text-ink">{mod.title}</p>
                    <p className="mt-1.5 text-[12px] leading-snug text-ink-mute">{mod.body}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[12px] text-ink-mute group-hover:text-ink">
                      Open
                      <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Research culture / expertise */}
      <section className="frame border-t border-ink/8 py-10 md:py-12">
        <Reveal>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">Research expertise</p>
          <h2 className="mt-1 text-xl font-light tracking-tight text-ink">What this culture holds</h2>
        </Reveal>
        <ul className="mt-6 flex flex-wrap gap-x-3 gap-y-3">
          {EXPERTISE.map((tag) => (
            <li
              key={tag}
              className="border border-ink/10 bg-pearl/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute"
            >
              {tag}
            </li>
          ))}
        </ul>
        <Reveal delay={0.08}>
          <p className="mt-8 max-w-xl text-[14px] leading-relaxed text-ink-mute">
            Tissue culture, phytochemistry, assay verification, IP drafting, and field collection —
            the board exists so those disciplines stay connected from plant to pack.
          </p>
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="frame pb-4">
        <Reveal>
          <div className="border border-ink/10 bg-ink px-6 py-9 text-paper md:px-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-soft">Collaborate</p>
            <p className="mt-3 max-w-lg text-[clamp(1.25rem,2.5vw,1.75rem)] font-light tracking-tight">
              Research partnerships, licensing, and institutional enquiries.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 text-[13px] text-paper underline-offset-4 hover:underline"
              >
                Contact the lab
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/patents"
                className="inline-flex items-center gap-1.5 text-[13px] text-paper/60 underline-offset-4 hover:text-paper hover:underline"
              >
                Patent register
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-[13px] text-paper/60 underline-offset-4 hover:text-paper hover:underline"
              >
                Research notebook
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
