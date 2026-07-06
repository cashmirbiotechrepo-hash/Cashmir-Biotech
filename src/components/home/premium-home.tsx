"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { ArrowRight, Atom, ShieldCheck, FlaskConical, ChevronRight, Microscope, Leaf, TestTube, Award, Package } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
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
  React.useEffect(() => {
    setMotionReady(true);
  }, []);
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

  // Hero text fades out (0% to 20% scroll)
  const storyHeroOpacity = useTransform(storyProgress, [0, 0.1, 0.2], [1, 1, 0]);
  const storyHeroY = useTransform(storyProgress, [0, 0.2], [0, reduceMotion ? 0 : -60]);

  // Product: starts right side, moves to left (0% to 60% scroll)
  // Moving from x=0 to x = -700px (approx to reach left side on desktop, less on mobile)
  const storyProductX = useTransform(storyProgress, [0, 0.1, 0.6], [0, reduceMotion ? 0 : -20, reduceMotion ? 0 : -550]);
  const storyProductRotate = useTransform(storyProgress, [0, 0.4], [-6, reduceMotion ? -6 : 0]);
  const storyProductScale = useTransform(storyProgress, [0, 0.5], [1, reduceMotion ? 1 : 1.05]);

  // Golden glow fades in behind product (30% to 60%)
  const storyGlowOpacity = useTransform(storyProgress, [0.3, 0.6], [0, reduceMotion ? 0 : 0.8]);

  // Details panel reveals (50% to 80%)
  const storyDetailsOpacity = useTransform(storyProgress, [0.5, 0.8], [0, reduceMotion ? 0 : 1]);
  const storyDetailsY = useTransform(storyProgress, [0.5, 0.8], [reduceMotion ? 0 : 40, 0]);

  // Floating badge cards fade out early (0% to 15%)
  const storyBadgeOpacity = useTransform(storyProgress, [0, 0.05, 0.15], [1, 1, 0]);

  const ambientOpacity = useTransform(storyProgress, [0, 0.4], [1, reduceMotion ? 1 : 0.4]);

  const sectionVariants = {
    hidden: { opacity: 0, y: 26, filter: "blur(8px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <main className="relative overflow-x-hidden">
      {/* ── Scroll-Driven Product Storytelling ── */}
      <section ref={storyRef} className="relative" style={{ height: "250vh" }}>
        <div className="sticky top-0 h-screen">
          {/* Ambient Background */}
          <motion.div style={{ opacity: ambientOpacity }} className="absolute inset-0 -z-10">
            <AmbientBackground />
          </motion.div>

          <div className="flex h-full items-center">
            <div className="relative mx-auto w-full max-w-7xl px-6">

              {/* ─── Hero Text Content (fades out on scroll) ─── */}
              <motion.div
                initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: reduceMotion ? 0.01 : 1, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <motion.div style={{ opacity: storyHeroOpacity, y: storyHeroY }} className="max-w-xl relative z-10">
                  <div className="mb-6 flex items-center">
                    <span className="bg-gradient-to-r from-primary/90 via-amber-400/90 to-primary/90 bg-clip-text text-[10px] font-extrabold uppercase tracking-[0.25em] text-transparent drop-shadow-sm">
                      {settings.heroSubtitle || "Proven biotech innovation from Kashmir biodiversity"}
                    </span>
                  </div>

                  <h1 className="max-w-2xl pb-1 text-5xl font-bold leading-[1.02] tracking-[-0.025em] text-heading md:text-7xl [font-family:var(--font-headline)]">
                    {formatHeroTitle(settings.heroTitle)}
                  </h1>

                  <p className="mt-5 max-w-xl text-base font-medium leading-[1.8] text-on-surface/70 md:text-[1.1rem]">
                    {settings.heroDescription}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <Link
                      href={settings.ctaPrimaryHref || "/products"}
                      className="group inline-flex items-center gap-2 rounded-md bg-primary-brand px-7 py-3.5 text-sm font-bold uppercase tracking-[0.13em] text-on-primary-container shadow-[0_15px_40px_rgba(234,179,8,0.22)] transition duration-300 motion-safe:hover:scale-[1.015] hover:brightness-110"
                    >
                      {settings.ctaPrimaryText || "Explore Catalog"}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link
                      href={settings.ctaSecondaryHref || "/patents"}
                      className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-transparent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.13em] text-heading transition hover:border-primary/50 hover:text-primary"
                    >
                      {settings.ctaSecondaryText || "View Science"}
                    </Link>
                  </div>

                  <div className="mt-10 flex items-center gap-10 md:gap-16">
                    {[
                      { label: "Purity Match", value: "99.7%" },
                      { label: "Clinical Confidence", value: "94%" },
                      { label: "Patents", value: "10+" }
                    ].map((m) => (
                      <div key={m.label} className="flex flex-col">
                        <p className="text-3xl font-bold tracking-tight text-heading [font-family:var(--font-headline)] md:text-4xl">{m.value}</p>
                        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-on-muted/80">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>

              {/* ─── Product Image + Badges (scroll-animated: right → left) ─── */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: reduceMotion ? 0.01 : 1.15, delay: reduceMotion ? 0 : 0.15 }}
                style={{ x: storyProductX, scale: storyProductScale }}
                className="absolute right-0 lg:right-6 top-1/2 -translate-y-1/2 w-[320px] h-[420px] md:w-[450px] md:h-[550px] z-20"
              >
                {/* Golden glow - fades in as product settles */}
                <motion.div
                  style={{ opacity: storyGlowOpacity }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(250,204,21,0.35),transparent_60%)] blur-[60px] pointer-events-none"
                />
                <motion.div
                  style={{ opacity: storyGlowOpacity }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(217,119,6,0.5),transparent_50%)] blur-3xl pointer-events-none"
                />
                
                {/* Product Image (Rotates on scroll) */}
                <motion.div style={{ rotate: storyProductRotate }} className="absolute inset-0 z-10">
                  <Image
                    src="/product-1.png"
                    alt="Cashmir Biotech Magic Food TaxO"
                    fill
                    priority
                    className="object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.9)]"
                  />
                </motion.div>

                {/* Badge Cards - attached to product container (but don't rotate), fade out on scroll */}
                <motion.div
                  style={{ opacity: storyBadgeOpacity }}
                  className="pointer-events-none absolute inset-0 z-30"
                >
                  <div className="absolute -left-6 md:-left-16 top-12 md:top-20">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-2xl">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-primary">Status</p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Verified
                      </p>
                    </div>
                  </div>
                  <div className="absolute -right-2 md:-right-8 bottom-16 md:bottom-24">
                    <div className="rounded-xl border border-white/10 bg-black/40 px-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-2xl">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-primary">Purity</p>
                      <p className="mt-1 text-sm font-semibold text-white">Clinical Grade</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* ─── Product Details Panel (reveals on right after product moves left) ─── */}
              <motion.div
                style={{ opacity: storyDetailsOpacity, y: storyDetailsY }}
                className="absolute right-[5%] top-[12%] max-w-lg z-10"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">Flagship Formulation</p>
                <h2 className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight text-white [font-family:var(--font-headline)] md:text-6xl">
                  Magic Food<br /><span className="bg-gradient-to-r from-primary to-[rgb(250_204_21)] bg-clip-text text-transparent">TaxO</span>
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-white/60">
                  A SKUAST-K research-backed formulation containing essential nutrients, minerals, and vitamins for daily vitality.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    { icon: <TestTube className="h-4 w-4" />, text: "Contains nutrients, minerals & vitamins" },
                    { icon: <Leaf className="h-4 w-4" />, text: "100% Natural · No Synthetics" },
                    { icon: <Award className="h-4 w-4" />, text: "SKUAST-K Verified Research" },
                    { icon: <Package className="h-4 w-4" />, text: "Net Weight: 250g" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        {item.icon}
                      </div>
                      <p className="text-sm font-medium text-white/80">{item.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10">
                  <Link
                    href="/products"
                    className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary to-[rgb(250_204_21)] px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-black shadow-[0_0_25px_rgba(250,204,21,0.3)] transition-all hover:brightness-110"
                  >
                    Explore Product
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>

            </div>
          </div>
        </div>
      </section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-7xl px-6 pb-20"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_8px_40px_rgb(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
            <InfiniteSlider gap={16} duration={40} durationOnHover={80}>
              <InfoTile icon={<Atom className="h-5 w-5" />} title="+42%" subtitle="Neural Path Density" />
              <InfoTile icon={<FlaskConical className="h-5 w-5" />} title="LC-MS" subtitle="Third-Party Verification" />
              <InfoTile icon={<ShieldCheck className="h-5 w-5" />} title="ISO Ready" subtitle="Quality System Discipline" />
              <InfoTile icon={<Microscope className="h-5 w-5" />} title="100%" subtitle="Phyto-active Extract" />
              <InfoTile icon={<ShieldCheck className="h-5 w-5" />} title="GMP" subtitle="Certified Facility" />
              <InfoTile icon={<Atom className="h-5 w-5" />} title="10+" subtitle="Global Patents" />
            </InfiniteSlider>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="mx-auto max-w-7xl px-6 py-12"
      >
        <motion.div
          className="mb-10 flex items-end justify-between gap-5"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Product Architecture</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-heading [font-family:var(--font-headline)] md:text-4xl">
              Featured Formulations
            </h2>
          </div>
          <Link href="/products" className="group hidden items-center gap-2 text-sm font-semibold text-on-muted md:flex">
            View all products <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {products.map((p, idx) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.75, delay: idx * 0.09, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProductRevealCard
                name={p.name}
                price={`₹${p.mrpInr.toLocaleString("en-IN")}`}
                image={p.imageUrl}
                description={p.description}
                detailsHref="/products"
                rating={4.9}
                reviewCount={100 + idx * 42}
                className="w-full"
              />
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="mx-auto max-w-7xl px-6 py-16"
      >
        <motion.div className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-7 md:p-10">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">Proof Layer</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight text-white [font-family:var(--font-headline)] md:text-5xl">
                Patents & Research Registry
              </h2>
            </div>
            <Link href="/patents" className="group flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-primary transition-colors">
              Full Registry <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {patents.map((patent, idx) => (
              <motion.article
                key={patent.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_8px_40px_rgb(0,0,0,0.5)] backdrop-blur-xl transition-colors hover:bg-black/60"
              >
                <SpotlightCard className="h-full p-8" glowColor="gold">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(250,204,21,0.15)] transition-transform duration-500 group-hover:scale-110">
                    <Microscope className="h-5 w-5" />
                  </div>
                  <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    {patent.patentCode}
                  </p>
                  <h3 className="mt-3 text-xl font-bold leading-tight tracking-tight text-white [font-family:var(--font-headline)]">
                    {patent.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-white/60 line-clamp-4">
                    {patent.summary}
                  </p>
                  <div className="mt-8 border-t border-white/10 pt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                      {patent.jurisdiction} <span className="mx-2 text-white/20">•</span>{" "}
                      <span className="text-primary/90">{patent.status}</span>
                    </p>
                  </div>
                </SpotlightCard>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="mx-auto max-w-7xl px-6 pb-32 pt-12"
      >
        <motion.div
          className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/60 shadow-[0_8px_40px_rgb(0,0,0,0.6)] backdrop-blur-2xl p-10 md:p-20"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.15),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(217,119,6,0.15),transparent_70%)] blur-3xl" />
          
          <div className="relative z-10 max-w-3xl">
            <h3 className="text-4xl font-bold leading-tight tracking-tight text-white [font-family:var(--font-headline)] md:text-5xl lg:text-6xl">
              Join the elite academic network around biotech precision.
            </h3>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Get exclusive access to white papers, formulation updates, and early-stage clinical insights from Cashmir Biotech.
            </p>
            {newsletterStatus === "success" ? (
              <p className="mt-10 max-w-xl rounded-xl border border-primary/25 bg-primary/10 px-6 py-4 text-sm font-semibold text-primary">
                Thank you — your application has been received. We will contact you at {newsletterEmail}.
              </p>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="mt-10 flex max-w-xl flex-col gap-4 sm:flex-row">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Institutional Email"
                  aria-label="Institutional Email"
                  className="h-14 flex-1 rounded-xl border border-white/10 bg-white/5 px-5 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-primary focus:bg-white/10"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === "loading"}
                  className="h-14 shrink-0 rounded-xl bg-gradient-to-r from-primary to-[rgb(250_204_21)] px-8 text-sm font-bold uppercase tracking-[0.12em] text-black shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {newsletterStatus === "loading" ? "Submitting..." : "Apply Now"}
                </button>
              </form>
            )}
            {newsletterStatus === "error" ? (
              <p className="mt-4 max-w-xl text-sm font-medium text-red-400">
                Something went wrong while submitting. Please try again.
              </p>
            ) : null}
            <p className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              <ShieldCheck className="h-4 w-4 text-primary/50" />
              Strict verification protocols required
            </p>
          </div>
        </motion.div>
      </motion.section>
    </main>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        animate={{ opacity: [0.45, 0.75, 0.45], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute left-1/2 top-[-220px] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.18),transparent_70%)] blur-3xl md:h-[560px] md:w-[900px]"
      />
    </div>
  );
}

function InfoTile({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex w-[280px] shrink-0 items-center p-6 text-left md:w-[320px] md:p-8 hover:bg-white/[0.02] transition-colors rounded-2xl">
      <div className="mr-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(250,204,21,0.2)] md:mr-5">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-white [font-family:var(--font-headline)] md:text-3xl">{title}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{subtitle}</p>
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
      <span className="bg-gradient-to-r from-primary to-[rgb(250_204_21)] bg-clip-text italic text-transparent">{focus}</span>
    </>
  );
}
