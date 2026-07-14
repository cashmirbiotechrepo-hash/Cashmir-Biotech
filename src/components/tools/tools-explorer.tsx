"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { cn } from "@/lib/utils";
import {
  DIFFICULTY_LABEL,
  MOLECULE_LABEL,
  TASK_ACTIONS,
  type Audience,
  type Difficulty,
  type Molecule,
  type TaskTag,
  type Tool,
  type ToolCategory
} from "@/components/tools/catalog";

export type ExplorerTool = Tool;
export type ExplorerCategory = ToolCategory;

type FlatTool = Tool & { categoryId: string; categoryName: string; categoryShort: string; accent: ToolCategory["accent"] };

const ACCENT_BAR: Record<ToolCategory["accent"], string> = {
  gold: "bg-gold",
  ink: "bg-ink/70",
  warm: "bg-gold-soft",
  slate: "bg-ink/40"
};

const ACCENT_TEXT: Record<ToolCategory["accent"], string> = {
  gold: "text-gold",
  ink: "text-ink-soft",
  warm: "text-gold/80",
  slate: "text-ink-mute"
};

function toolMatches(
  t: FlatTool,
  opts: {
    q: string;
    domain: string;
    molecule: Molecule | "all";
    difficulty: Difficulty | "all";
    audience: Audience | "all";
    task: TaskTag | "all";
    liveOnly: boolean;
  }
) {
  if (opts.domain !== "all" && t.categoryId !== opts.domain) return false;
  if (opts.liveOnly && t.status !== "live") return false;
  if (opts.molecule !== "all" && !t.molecules.includes(opts.molecule) && !t.molecules.includes("any")) {
    return false;
  }
  if (opts.difficulty !== "all" && t.difficulty !== opts.difficulty) return false;
  if (opts.audience !== "all" && !t.audience.includes(opts.audience)) return false;
  if (opts.task !== "all" && !t.tasks.includes(opts.task)) return false;
  if (
    opts.q &&
    !`${t.name} ${t.blurb} ${t.engine} ${t.categoryName} ${t.whenToUse} ${t.input} ${t.output}`
      .toLowerCase()
      .includes(opts.q)
  ) {
    return false;
  }
  return true;
}

export function ToolsExplorer({
  categories,
  recommended,
  popular
}: {
  categories: ExplorerCategory[];
  recommended: Tool[];
  popular: Tool[];
}) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [molecule, setMolecule] = useState<Molecule | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [task, setTask] = useState<TaskTag | "all">("all");
  const [liveOnly, setLiveOnly] = useState(true);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [openDomains, setOpenDomains] = useState<Record<string, boolean>>({});

  const allTools = useMemo<FlatTool[]>(
    () =>
      categories.flatMap((c) =>
        c.tools.map((t) => ({
          ...t,
          categoryId: c.id,
          categoryName: c.name,
          categoryShort: c.shortName,
          accent: c.accent
        }))
      ),
    [categories]
  );

  const q = query.trim().toLowerCase();
  const filterOpts = useMemo(
    () => ({ q, domain, molecule, difficulty, audience, task, liveOnly }),
    [q, domain, molecule, difficulty, audience, task, liveOnly]
  );

  const matches = useMemo(
    () => allTools.filter((t) => toolMatches(t, filterOpts)),
    [allTools, filterOpts]
  );

  const filtering =
    domain !== "all" ||
    molecule !== "all" ||
    difficulty !== "all" ||
    audience !== "all" ||
    task !== "all" ||
    Boolean(q) ||
    !liveOnly;

  // Expand domains with live matches; when filtering, force-open hits.
  useEffect(() => {
    setOpenDomains((prev) => {
      const next = { ...prev };
      for (const c of categories) {
        const hasLive = matches.some((t) => t.categoryId === c.id && t.status === "live");
        if (filtering && hasLive) next[c.id] = true;
        else if (next[c.id] === undefined) next[c.id] = hasLive;
      }
      return next;
    });
  }, [categories, matches, filtering]);

  function jumpDomain(id: string) {
    setDomain(id);
    setOpenDomains((p) => ({ ...p, [id]: true }));
    document.getElementById(`domain-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setQuery("");
    setDomain("all");
    setMolecule("all");
    setDifficulty("all");
    setAudience("all");
    setTask("all");
    setLiveOnly(true);
  }

  const liveMatches = matches.filter((t) => t.status === "live");
  const comingSoon = matches.filter((t) => t.status === "documented");

  return (
    <div className="space-y-14 md:space-y-16">
      {/* 1. Quick actions — task-based entry */}
      <section aria-labelledby="quick-actions-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">What do you need?</p>
            <h2 id="quick-actions-heading" className="mt-1 text-lg font-light tracking-tight text-ink md:text-xl">
              Jump by task
            </h2>
          </div>
          {task !== "all" ? (
            <button
              type="button"
              onClick={() => setTask("all")}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
            >
              Clear task
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TASK_ACTIONS.map((a) => {
            const active = task === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setTask(a.id);
                  setLiveOnly(true);
                  document.getElementById("suite-control")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "group border px-3 py-3 text-left transition-colors",
                  active
                    ? "border-gold/50 bg-gold/5"
                    : "border-ink/10 hover:border-ink/25 hover:bg-pearl/50"
                )}
              >
                <p className={cn("text-[13px] font-medium", active ? "text-ink" : "text-ink-soft")}>{a.label}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">{a.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Recommended path */}
      <section aria-labelledby="path-heading">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Recommended path</p>
        <h2 id="path-heading" className="mt-1 text-lg font-light tracking-tight text-ink md:text-xl">
          Start here if you are new
        </h2>
        <ol className="mt-5 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {recommended.map((tool, i) => (
            <li key={tool.slug} className="shrink-0">
              <Link
                href={`/tools/${tool.slug}`}
                data-cursor="Open"
                className="group flex w-[min(72vw,220px)] items-stretch border border-ink/10 transition-colors hover:border-gold/40 hover:bg-pearl/40"
              >
                <span className="flex w-9 items-center justify-center border-r border-ink/8 font-mono text-[11px] text-gold">
                  {i + 1}
                </span>
                <span className="flex flex-1 flex-col justify-center px-3 py-3">
                  <span className="text-[13px] font-medium text-ink group-hover:text-gold">{tool.name}</span>
                  <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                    {DIFFICULTY_LABEL[tool.difficulty]} · {tool.runtime}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Popular / operational */}
      <section aria-labelledby="popular-heading">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Most used</p>
            <h2 id="popular-heading" className="mt-1 text-lg font-light tracking-tight text-ink md:text-xl">
              Popular tools
            </h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {popular.length} operational
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px bg-ink/8 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((tool) => {
            const cat = categories.find((c) => c.tools.some((t) => t.slug === tool.slug));
            return (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                data-cursor="Open"
                className="group relative bg-ivory p-4 transition-colors hover:bg-pearl/80"
              >
                <span
                  className={cn(
                    "absolute left-0 top-0 h-full w-0.5",
                    ACCENT_BAR[cat?.accent ?? "gold"]
                  )}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                      {cat?.shortName} · {tool.molecules.map((m) => MOLECULE_LABEL[m]).join(" / ")}
                    </p>
                    <h3 className="mt-1 text-[14px] font-medium tracking-tight text-ink group-hover:text-gold">
                      {tool.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-mute">{tool.whenToUse}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-gold">Open →</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
                  <MetaPill>{DIFFICULTY_LABEL[tool.difficulty]}</MetaPill>
                  <MetaPill>{tool.runtime}</MetaPill>
                  <MetaPill>{tool.input.split(" ")[0]}</MetaPill>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. Control center + catalogue */}
      <section id="suite-control" className="scroll-mt-28 border-t border-ink/10 pt-10">
        <div className="mb-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">Suite control</p>
          <h2 className="mt-1 text-lg font-light tracking-tight text-ink md:text-xl">Browse by domain</h2>
          <p className="mt-1 max-w-xl text-[13px] text-ink-mute">
            One filter surface. Expand a domain when you need depth — roadmap tools stay collapsed.
          </p>
        </div>

        <div className="sticky top-[4.75rem] z-30 -mx-6 mb-8 border-y border-ink/8 bg-ivory/95 px-6 py-3 backdrop-blur-md md:top-[5.25rem]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <label className="relative flex min-w-0 flex-1 items-center md:max-w-xs">
                <Search className="pointer-events-none absolute left-0 h-3.5 w-3.5 text-ink-faint" strokeWidth={1.6} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, task, input…"
                  className="w-full border-0 border-b border-transparent bg-transparent py-1.5 pl-6 pr-7 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink/20"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-0 text-ink-faint hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>

              <SelectChip
                label="Molecule"
                value={molecule}
                onChange={(v) => setMolecule(v as Molecule | "all")}
                options={[
                  { value: "all", label: "Any molecule" },
                  { value: "dna", label: "DNA" },
                  { value: "rna", label: "RNA" },
                  { value: "protein", label: "Protein" }
                ]}
              />
              <SelectChip
                label="Level"
                value={difficulty}
                onChange={(v) => setDifficulty(v as Difficulty | "all")}
                options={[
                  { value: "all", label: "Any level" },
                  { value: "beginner", label: "Beginner" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" }
                ]}
              />
              <SelectChip
                label="Audience"
                value={audience}
                onChange={(v) => setAudience(v as Audience | "all")}
                options={[
                  { value: "all", label: "Any audience" },
                  { value: "student", label: "Student" },
                  { value: "researcher", label: "Researcher" },
                  { value: "lab", label: "Lab" },
                  { value: "developer", label: "Developer" }
                ]}
              />

              <button
                type="button"
                role="switch"
                aria-checked={liveOnly}
                onClick={() => setLiveOnly((v) => !v)}
                className={cn(
                  "shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]",
                  liveOnly ? "text-gold" : "text-ink-faint hover:text-ink"
                )}
              >
                <span
                  className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", liveOnly ? "bg-gold" : "bg-ink/25")}
                />
                {liveOnly ? "Operational only" : "Include roadmap"}
              </button>

              {filtering ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {liveMatches.length} operational
              {!liveOnly ? ` · ${comingSoon.length} on roadmap` : ""}
              {task !== "all" ? ` · task: ${TASK_ACTIONS.find((a) => a.id === task)?.label}` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
          {/* Domain rail — persistent wayfinding */}
          <nav
            aria-label="Scientific domains"
            className="hidden lg:block lg:sticky lg:top-[9.5rem] lg:self-start"
          >
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">Domains</p>
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => setDomain("all")}
                  className={cn(
                    "w-full px-2 py-1.5 text-left text-[13px] transition-colors",
                    domain === "all" ? "text-ink" : "text-ink-faint hover:text-ink-mute"
                  )}
                >
                  All domains
                </button>
              </li>
              {categories.map((c) => {
                const liveCount = c.tools.filter((t) => t.status === "live").length;
                const matchCount = matches.filter((t) => t.categoryId === c.id).length;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => jumpDomain(c.id)}
                      className={cn(
                        "group flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors",
                        domain === c.id ? "text-ink" : "text-ink-faint hover:text-ink-mute"
                      )}
                    >
                      <span className={cn("h-3 w-0.5 shrink-0", ACCENT_BAR[c.accent])} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{c.shortName}</span>
                      <span className="font-mono text-[9px] text-ink-faint">
                        {filtering ? matchCount : liveCount}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Accordion catalogue */}
          <div className="min-w-0 space-y-3">
            {liveMatches.length === 0 && (liveOnly || comingSoon.length === 0) ? (
              <div className="border border-ink/10 py-16 text-center">
                <p className="technical mb-2 !text-ink-soft">No matching tools</p>
                <p className="mx-auto max-w-sm text-sm text-ink-mute">Try another filter, or reset.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 text-[13px] text-ink underline-offset-4 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : null}

            {categories.map((category) => {
              const live = matches.filter((t) => t.categoryId === category.id && t.status === "live");
              const mapped = matches.filter((t) => t.categoryId === category.id && t.status === "documented");
              if (live.length === 0 && (liveOnly || mapped.length === 0)) return null;
              if (domain !== "all" && domain !== category.id) return null;

              const open = openDomains[category.id] ?? live.length > 0;
              const totalLive = category.tools.filter((t) => t.status === "live").length;
              const totalMapped = category.tools.filter((t) => t.status === "documented").length;

              return (
                <div
                  key={category.id}
                  id={`domain-${category.id}`}
                  className="scroll-mt-40 border border-ink/10"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenDomains((p) => ({ ...p, [category.id]: !open }))}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-pearl/40 md:px-5"
                  >
                    <span className={cn("mt-1.5 h-8 w-0.5 shrink-0", ACCENT_BAR[category.accent])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className={cn("font-mono text-[10px]", ACCENT_TEXT[category.accent])}>
                          {String(category.number).padStart(2, "0")}
                        </span>
                        <h3 className="text-base font-light tracking-tight text-ink md:text-lg">
                          {category.name}
                        </h3>
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                          {totalLive} tools
                          {totalMapped > 0 ? ` · ${totalMapped} coming` : ""}
                        </span>
                        {category.beginnerFriendly ? (
                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
                            Beginner friendly
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] text-ink-mute">{category.summary}</p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300",
                        open && "rotate-180"
                      )}
                      strokeWidth={1.5}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="overflow-hidden"
                      >
                        <ul className="border-t border-ink/8">
                          {live.map((tool) => (
                            <li key={tool.slug} className="border-b border-ink/6 last:border-b-0">
                              <ToolDenseRow tool={tool} />
                            </li>
                          ))}
                        </ul>
                        {!liveOnly && mapped.length > 0 ? (
                          <ul className="border-t border-ink/6 bg-pearl/30">
                            {mapped.map((tool) => (
                              <li
                                key={tool.slug}
                                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 md:px-5"
                              >
                                <span className="text-[13px] text-ink-mute">{tool.name}</span>
                                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                                  Roadmap · {tool.engine}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Coming soon — separate, collapsed by default */}
            {liveOnly ? (
              <div className="border border-dashed border-ink/15">
                <button
                  type="button"
                  aria-expanded={showComingSoon}
                  onClick={() => setShowComingSoon((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left md:px-5"
                >
                  <span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                      Coming soon
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-mute">
                      {allTools.filter((t) => t.status === "documented").length} mapped engines — not yet
                      operational
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-ink-faint transition-transform",
                      showComingSoon && "rotate-180"
                    )}
                    strokeWidth={1.5}
                  />
                </button>
                {showComingSoon ? (
                  <ul className="border-t border-ink/8 px-4 py-2 md:px-5">
                    {allTools
                      .filter((t) => t.status === "documented")
                      .map((tool) => (
                        <li
                          key={tool.slug}
                          className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/6 py-2 last:border-0"
                        >
                          <span className="text-[13px] text-ink-mute">
                            {tool.name}
                            <span className="ml-2 font-mono text-[9px] text-ink-faint">{tool.categoryShort}</span>
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                            {tool.engine}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-ink/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
      {children}
    </span>
  );
}

function SelectChip({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[9.5rem] cursor-pointer appearance-none border-0 border-b border-ink/15 bg-transparent py-1 pr-4 text-[12px] text-ink outline-none focus:border-gold/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolDenseRow({ tool }: { tool: FlatTool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      data-cursor="Open"
      className="group flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-pearl/50 sm:flex-row sm:items-center sm:justify-between md:px-5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[14px] font-medium tracking-tight text-ink group-hover:text-gold">{tool.name}</h4>
          <MetaPill>{DIFFICULTY_LABEL[tool.difficulty]}</MetaPill>
          {tool.popular ? <MetaPill>Popular</MetaPill> : null}
        </div>
        <p className="mt-1 line-clamp-1 text-[12px] text-ink-mute">{tool.whenToUse}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          <span>{tool.molecules.map((m) => MOLECULE_LABEL[m]).join(" · ")}</span>
          <span>In {tool.input}</span>
          <span>Out {tool.output}</span>
          <span>{tool.runtime}</span>
        </div>
      </div>
      <span className="shrink-0 self-start font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition-colors group-hover:text-gold sm:self-center">
        Open tool →
      </span>
    </Link>
  );
}
