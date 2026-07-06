"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants
} from "framer-motion";
import {
  ArrowRight,
  Atom,
  ShieldCheck,
  FlaskConical,
  ChevronRight,
  Microscope,
  Mountain,
  Beaker,
  ScanLine,
  FileCheck,
  TestTube,
  Award
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProductRevealCard } from "@/components/ui/product-reveal-card";

type ProductItem = {
  id: string;
  name: string;
  shortBenefit: string;
  description: string;
  mrpInr: number;
  sizeLabel: string;
  imageUrl: string;
};

type PatentItem = {
  id: string;
  patentCode: string;
  title: string;
  summary: string;
  jurisdiction: string;
  status: string;
};

type Settings = {
  heroTitle: string;
  heroDescription: string;
  heroSubtitle: string;
  ctaPrimaryText: string;
  ctaPrimaryHref: string;
  ctaSecondaryText: string;
  ctaSecondaryHref: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

const PROCESS_STEPS = [
  {
    phase: "Source",
    title: "Himalayan phyto selection",
    detail: "Botanicals traced to Kashmir's altitude and biodiversity corridors before any extraction begins.",
    icon: Mountain
  },
  {
    phase: "Extract",
    title: "Cold-chain phyto-active isolation",
    detail: "Non-synthetic extraction preserves mineral complexes and vitamin cofactors at research grade.",
    icon: Beaker
  },
  {
    phase: "Verify",
    title: "Independent assay & documentation",
    detail: "LC-MS verification, batch records, and SKUAST-K research alignment for every flagship run.",
    icon: ScanLine
  },
  {
    phase: "Formulate",
    title: "Clinical-ready daily nutrition",
    detail: "Finished formulations calibrated for absorption, stability, and transparent labeling.",
    icon: FileCheck
  }
] as const;

export function PremiumHome({
  settings,
  products,
  patents
}: {
  settings: Settings;
  products: ProductItem[];
  patents: PatentItem[];
}) {
  const reducedMotionPref = useReducedMotion();
  const [motionReady, setMotionReady] = React.useState(false);
  React.useEffect(() => setMotionReady(true), []);
  const reduceMotion = motionReady ? Boolean(reducedMotionPref) : false;

  const [newsletterEmail, setNewsletterEmail] = React.useState("");
  const [newsletterStatus, setNewsletterStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");

  const handleNewsletterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email || newsletterStatus === "loading") return;
    setNewsletterStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setNewsletterStatus(res.ok ? "success" : "error");
    } catch {
      setNewsletterStatus("error");
    }
  };

  const storyRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress: storyProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"]
  });

  const [productShift, setProductShift] = React.useState(-520);
  React.useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      if (vw < 768) setProductShift(-Math.max(vw - 300 - 28, 0));
      else setProductShift(-(Math.min(vw, 1280) - 48 - 420 - 32));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const storyHeroOpacity = useTransform(storyProgress, [0, 0.12, 0.22], [1, 1, 0]);
  const storyHeroY = useTransform(storyProgress, [0, 0.22], [0, reduceMotion ? 0 : -48]);
  const storyHeroPointerEvents = useTransform(storyHeroOpacity, (v) => (v < 0.3 ? "none" : "auto"));
  const storyProductX = useTransform(
    storyProgress,
    [0, 0.12, 0.58],
    [0, reduceMotion ? 0 : -16, reduceMotion ? 0 : productShift]
  );
  const storyProductRotate = useTransform(storyProgress, [0, 0.45], [-4, reduceMotion ? -4 : 0]);
  const storyGlowOpacity = useTransform(storyProgress, [0.28, 0.55], [0, reduceMotion ? 0 : 0.75]);
  const storyDetailsOpacity = useTransform(storyProgress, [0.48, 0.78], [0, 1]);
  const storyDetailsY = useTransform(storyProgress, [0.48, 0.78], [reduceMotion ? 0 : 32, 0]);
  const storyDetailsPointerEvents = useTransform(storyDetailsOpacity, (v) => (v > 0.5 ? "auto" : "none"));
  const apertureScale = useTransform(storyProgress, [0, 0.5], [1, reduceMotion ? 1 : 1.08]);

  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0.01 : 0.85, ease: EASE }
    }
  };

  const flagship = products[0];
  const supportingProducts = products.slice(1, 3);

  return (
    <main className="home-atmosphere relative overflow-x-clip">
      {/* ── Signature: scroll-driven specimen narrative ── */}
      <section ref={storyRef} className="relative" style={{ height: "240vh" }} aria-label="Hero">
        <div className="sticky top-0 flex min-h-[100dvh] items-center">
          <div className="home-grain pointer-events-none absolute inset-0" />

          <div className="relative mx-auto w-full max-w-[1320px] px-5 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 1, ease: EASE }}
              className="grid min-h-[min(88dvh,920px)] items-center lg:grid-cols-[1fr_1.05fr]"
            >
              <motion.div
                style={{ opacity: storyHeroOpacity, y: storyHeroY, pointerEvents: storyHeroPointerEvents }}
                className="relative z-20 max-w-xl py-16 lg:py-0"
              >
                <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface-container-low/80 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgb(234_179_8/0.8)]" aria-hidden />
                  {settings.heroSubtitle}
                </p>

                <h1 className="text-balance text-[2.65rem] font-medium leading-[1.02] tracking-[-0.03em] text-heading md:text-6xl lg:text-[4.25rem] [font-family:var(--font-headline)]">
                  {formatHeroTitle(settings.heroTitle)}
                </h1>

                <p className="text-pretty mt-6 max-w-[38ch] text-[1.05rem] leading-[1.75] text-on-surface/75">
                  {settings.heroDescription}
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link
                    href={settings.ctaPrimaryHref || "/products"}
                    className="group inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_rgb(234_179_8/0.18)] transition duration-300 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:hover:-translate-y-0.5"
                  >
                    {settings.ctaPrimaryText || "Explore catalog"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                  <Link
                    href={settings.ctaSecondaryHref || "/patents"}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-6 py-3 text-sm font-medium text-heading transition duration-300 hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {settings.ctaSecondaryText || "View patents"}
                  </Link>
                </div>

                <dl className="mt-12 grid max-w-md grid-cols-2 gap-4 border-t border-outline-variant/25 pt-8 sm:grid-cols-3">
                  {[
                    { term: "Research partner", value: "SKUAST-K" },
                    { term: "Origin", value: "Kashmir" },
                    { term: "Filings", value: "10+" }
                  ].map((item) => (
                    <div key={item.term}>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-on-muted">{item.term}</dt>
                      <dd className="tabular-nums mt-1.5 text-lg font-semibold text-heading [font-family:var(--font-headline)]">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.div>

              <div className="relative hidden min-h-[520px] lg:block">
                <motion.div
                  style={{ scale: apertureScale }}
                  className="home-specimen-ring pointer-events-none absolute left-1/2 top-1/2 h-[min(72vw,560px)] w-[min(72vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[2px]"
                  aria-hidden
                />
                <motion.div
                  style={{ opacity: storyGlowOpacity }}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(234_179_8/0.28),transparent_68%)] blur-3xl"
                  aria-hidden
                />

                <motion.div
                  style={{ x: storyProductX, rotate: storyProductRotate }}
                  className="absolute right-0 top-1/2 z-20 h-[480px] w-[340px] -translate-y-1/2 md:h-[540px] md:w-[400px]"
                >
                  <Image
                    src="/product-1.png"
                    alt="Cashmir Biotech Magic Food TaxO formulation"
                    fill
                    priority
                    className="object-contain drop-shadow-[0_40px_80px_rgb(0_0_0/0.65)]"
                  />
                  <SpecimenLabel top="8%" left="-12%" label="Batch verified" value="LC-MS aligned" />
                  <SpecimenLabel bottom="14%" right="-6%" label="Form factor" value="250g clinical pack" />
                </motion.div>

                <motion.div
                  style={{ opacity: storyDetailsOpacity, y: storyDetailsY, pointerEvents: storyDetailsPointerEvents }}
                  className="absolute left-0 top-[18%] z-30 max-w-sm rounded-2xl border border-white/10 bg-surface-container-low/90 p-7 shadow-[0_24px_60px_rgb(0_0_0/0.45)] backdrop-blur-xl"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Flagship formulation</p>
                  <h2 className="mt-3 text-3xl font-medium leading-tight text-heading [font-family:var(--font-headline)]">
                    Magic Food <span className="text-primary">TaxO</span>
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-on-surface/70">
                    SKUAST-K aligned daily nutrition with minerals, vitamins, and phyto-actives — no synthetic fillers.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      "Nutrient-dense mineral matrix",
                      "100% natural sourcing",
                      "Research-grade documentation"
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-3 text-sm text-on-surface/80">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/products"
                    className="group mt-8 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    View formulation details
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            {/* Mobile product — static, no scroll choreography */}
            <div className="relative mx-auto mb-10 h-[340px] w-[260px] lg:hidden">
              <Image
                src="/product-1.png"
                alt="Cashmir Biotech Magic Food TaxO"
                fill
                priority
                className="object-contain drop-shadow-[0_24px_48px_rgb(0_0_0/0.5)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Origin: Kashmir biodiversity thesis ── */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="relative z-10 mx-auto max-w-[1320px] px-5 pb-16 md:px-8 md:pb-24"
      >
        <div className="grid gap-10 rounded-[2rem] border border-outline-variant/20 bg-surface-container-low/60 p-8 md:grid-cols-[1.1fr_0.9fr] md:p-12 lg:gap-16">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-bronze">Himalayan origin</p>
            <h2 className="text-balance mt-4 text-3xl font-medium leading-[1.08] text-heading md:text-5xl [font-family:var(--font-headline)]">
              Biodiversity becomes measurable nutrition
            </h2>
            <p className="text-pretty mt-5 max-w-[52ch] text-base leading-[1.8] text-on-surface/72">
              Cashmir Biotech translates Kashmir&apos;s phyto-rich ecosystems into formulations backed by university
              research, patent filings, and transparent manufacturing discipline — built for clinicians, institutions,
              and discerning consumers who read labels.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Mountain, title: "Altitude traceability", copy: "Source corridors documented from field to facility." },
              { icon: Microscope, title: "Assay-first culture", copy: "Verification protocols precede marketing claims." },
              { icon: Award, title: "Patent registry", copy: "Published filings available in our research archive." },
              { icon: ShieldCheck, title: "Quality system", copy: "GMP-aligned processes with batch-level records." }
            ].map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-outline-variant/15 bg-surface/50 p-5 transition duration-300 hover:border-primary/25 hover:bg-surface-container/80"
              >
                <card.icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-heading">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-on-muted">{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Process pipeline (real sequence, not decorative numbers) ── */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-[1320px] px-5 py-8 md:px-8 md:py-12"
        aria-labelledby="process-heading"
      >
        <div className="mb-12 max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">Manufacturing chain</p>
          <h2 id="process-heading" className="mt-3 text-3xl font-medium text-heading md:text-4xl [font-family:var(--font-headline)]">
            From alpine source to sealed formulation
          </h2>
        </div>
        <ol className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PROCESS_STEPS.map((step, index) => (
            <li
              key={step.phase}
              className="group relative overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 p-6 transition duration-300 hover:border-primary/30"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{step.phase}</span>
                <step.icon className="h-5 w-5 text-on-muted transition group-hover:text-primary" aria-hidden />
              </div>
              <p className="mt-6 text-xs font-medium uppercase tracking-[0.16em] text-on-muted">Stage {index + 1}</p>
              <h3 className="mt-2 text-xl font-medium text-heading [font-family:var(--font-headline)]">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-on-surface/68">{step.detail}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* ── Standards marquee ── */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="mx-auto max-w-[1320px] px-5 pb-12 md:px-8"
      >
        <div className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container/50">
          <div className="[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <InfiniteSlider gap={12} duration={45} durationOnHover={90}>
              <InfoTile icon={<FlaskConical className="h-5 w-5" />} title="LC-MS" subtitle="Third-party verification" />
              <InfoTile icon={<ShieldCheck className="h-5 w-5" />} title="GMP" subtitle="Facility discipline" />
              <InfoTile icon={<Atom className="h-5 w-5" />} title="Phyto-active" subtitle="Non-synthetic extracts" />
              <InfoTile icon={<Microscope className="h-5 w-5" />} title="SKUAST-K" subtitle="Research alignment" />
              <InfoTile icon={<TestTube className="h-5 w-5" />} title="Batch logs" subtitle="Traceable production" />
              <InfoTile icon={<Award className="h-5 w-5" />} title="10+ filings" subtitle="Patent registry" />
            </InfiniteSlider>
          </div>
        </div>
      </motion.section>

      {/* ── Featured formulations — asymmetric bento ── */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-[1320px] px-5 py-12 md:px-8 md:py-16"
        aria-labelledby="products-heading"
      >
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">Formulation library</p>
            <h2 id="products-heading" className="mt-2 text-3xl font-medium text-heading md:text-4xl [font-family:var(--font-headline)]">
              Featured products
            </h2>
          </div>
          <Link
            href="/products"
            className="group inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-on-muted transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Full catalog
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/30 p-12 text-center text-on-muted">
            Formulations will appear here once published from the admin dashboard.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-12 lg:grid-rows-2">
            {flagship ? (
              <motion.article
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: EASE }}
                className="lg:col-span-7 lg:row-span-2"
              >
                <ProductRevealCard
                  name={flagship.name}
                  price={`₹${flagship.mrpInr.toLocaleString("en-IN")}`}
                  image={flagship.imageUrl}
                  description={flagship.description}
                  detailsHref="/products"
                  rating={4.9}
                  reviewCount={128}
                  className="h-full min-h-[420px] w-full"
                />
              </motion.article>
            ) : null}
            <div className="grid gap-5 lg:col-span-5 lg:row-span-2">
              {supportingProducts.map((p, idx) => (
                <motion.article
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: idx * 0.08, ease: EASE }}
                >
                  <ProductRevealCard
                    name={p.name}
                    price={`₹${p.mrpInr.toLocaleString("en-IN")}`}
                    image={p.imageUrl}
                    description={p.shortBenefit || p.description}
                    detailsHref="/products"
                    rating={4.8}
                    reviewCount={64 + idx * 17}
                    className="w-full"
                  />
                </motion.article>
              ))}
            </div>
          </div>
        )}
      </motion.section>

      {/* ── Patent registry ── */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-[1320px] px-5 py-12 md:px-8 md:py-20"
        aria-labelledby="patents-heading"
      >
        <div className="rounded-[2rem] border border-outline-variant/20 bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high p-8 md:p-12">
          <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">Proof layer</p>
              <h2 id="patents-heading" className="mt-3 text-3xl font-medium text-heading md:text-5xl [font-family:var(--font-headline)]">
                Patents & research registry
              </h2>
            </div>
            <Link
              href="/patents"
              className="group inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-on-muted transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Open full registry
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>

          {patents.length === 0 ? (
            <p className="text-on-muted">Patent records will be listed here when available.</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {patents.map((patent, idx) => (
                <motion.article
                  key={patent.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.65, delay: idx * 0.07, ease: EASE }}
                  className="group"
                >
                  <SpotlightCard className="h-full rounded-2xl border border-outline-variant/15 p-7" glowColor="gold">
                    <Microscope className="h-5 w-5 text-primary" aria-hidden />
                    <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                      {patent.patentCode}
                    </p>
                    <h3 className="mt-3 text-xl font-medium leading-snug text-heading [font-family:var(--font-headline)]">
                      {patent.title}
                    </h3>
                    <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-on-surface/68">{patent.summary}</p>
                    <p className="mt-8 border-t border-outline-variant/20 pt-5 text-[11px] font-medium uppercase tracking-widest text-on-muted">
                      {patent.jurisdiction}
                      <span className="mx-2 text-outline-variant">·</span>
                      <span className="text-primary/90">{patent.status}</span>
                    </p>
                  </SpotlightCard>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ── Research network CTA ── */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="mx-auto max-w-[1320px] px-5 pb-28 pt-4 md:px-8 md:pb-36"
      >
        <div className="home-grain relative overflow-hidden rounded-[2rem] border border-outline-variant/25 bg-surface-container-low p-10 md:p-16">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgb(234_179_8/0.12),transparent_70%)] blur-3xl"
            aria-hidden
          />
          <div className="relative z-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h3 className="text-balance text-3xl font-medium leading-tight text-heading md:text-5xl [font-family:var(--font-headline)]">
                Receive formulation briefs and research releases
              </h3>
              <p className="text-pretty mt-5 max-w-lg text-base leading-relaxed text-on-surface/72">
                Institutional updates on new filings, batch documentation, and clinical-adjacent insights — no promotional
                noise.
              </p>
            </div>

            <div>
              {newsletterStatus === "success" ? (
                <p className="rounded-xl border border-primary/25 bg-primary/10 px-6 py-4 text-sm font-medium text-primary">
                  Thank you. We&apos;ll reach out at {newsletterEmail} when the next brief is available.
                </p>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Work or institutional email"
                    aria-label="Work or institutional email"
                    className="h-12 min-h-11 flex-1 rounded-xl border border-outline-variant/30 bg-surface/60 px-4 text-sm text-heading placeholder:text-on-muted outline-none transition duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === "loading"}
                    className="h-12 min-h-11 shrink-0 cursor-pointer rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition duration-300 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-safe:hover:-translate-y-0.5"
                  >
                    {newsletterStatus === "loading" ? "Sending…" : "Request access"}
                  </button>
                </form>
              )}
              {newsletterStatus === "error" ? (
                <p className="mt-3 text-sm font-medium text-red-400">Something went wrong. Please try again.</p>
              ) : null}
              <p className="mt-5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-on-muted">
                <ShieldCheck className="h-4 w-4 text-primary/60" aria-hidden />
                Verified institutional correspondence only
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </main>
  );
}

function SpecimenLabel({
  label,
  value,
  top,
  left,
  right,
  bottom
}: {
  label: string;
  value: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
}) {
  return (
    <div
      className="absolute hidden rounded-xl border border-white/10 bg-black/50 px-4 py-3 shadow-[0_12px_40px_rgb(0_0_0/0.45)] backdrop-blur-xl md:block"
      style={{ top, left, right, bottom }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-primary">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function InfoTile({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex w-[260px] shrink-0 items-center gap-4 rounded-xl px-5 py-5 md:w-[300px]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="tabular-nums text-xl font-semibold text-heading [font-family:var(--font-headline)]">{title}</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-on-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function formatHeroTitle(title: string) {
  const needle = "daily vitality";
  if (!title.toLowerCase().includes(needle)) return title;

  const idx = title.toLowerCase().indexOf(needle);
  const before = title.slice(0, idx).trimEnd();
  const focus = title.slice(idx, idx + needle.length);

  return (
    <>
      <span>{before} </span>
      <span className="italic text-primary">{focus}</span>
    </>
  );
}
