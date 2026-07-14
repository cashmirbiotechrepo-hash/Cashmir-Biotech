"use client";

import { Hero } from "@/components/home/sections/hero";
import { Marquee } from "@/components/home/sections/marquee";
import { Platform } from "@/components/home/sections/platform";
import { Metrics } from "@/components/home/sections/metrics";
import { Pipeline } from "@/components/home/sections/pipeline";
import { Products } from "@/components/home/sections/products";
import { Patents } from "@/components/home/sections/patents";
import { Mission } from "@/components/home/sections/mission";
import { Faq } from "@/components/home/sections/faq";
import { CtaNewsletter } from "@/components/home/sections/cta-newsletter";
import type { HomeContent } from "@/components/home/content";

/**
 * Homepage content only. The persistent chrome (nav, footer, loader, ambient
 * background, smooth scroll) is provided by the public shell/layout.
 */
export function HomeExperience({ content }: { content: HomeContent }) {
  return (
    <>
      <Hero content={content} />
      <Marquee items={content.marquee} />
      <Platform />
      <Metrics metrics={content.metrics} />
      <Pipeline stages={content.pipeline} />
      <Products products={content.products} />
      <Patents patents={content.patents} />
      <Mission statement={content.mission} />
      <Faq faqs={content.faqs} />
      <CtaNewsletter />
    </>
  );
}
