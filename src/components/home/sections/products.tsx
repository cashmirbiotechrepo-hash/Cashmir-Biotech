"use client";

import Link from "next/link";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { TiltCard } from "@/components/ui/tilt-card";
import { ProductVisual } from "@/components/ui/product-visual";
import type { ProductCard } from "@/components/home/content";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export function Products({ products }: { products: ProductCard[] }) {
  return (
    <section id="formulations" className="relative py-24 md:py-44">
      <div className="frame">
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Reveal>
              <p className="technical mb-5">Flagship Formulations</p>
            </Reveal>
            <h2 className="max-w-xl text-[clamp(2rem,4vw,3.5rem)] font-light leading-[1.05] tracking-tightest">
              <RevealText text="Nutrition, engineered molecule-first." accentWords={[2]} />
            </h2>
          </div>
          <Reveal delay={0.1}>
            <Link
              href="/products"
              data-cursor="Open"
              className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute transition-colors hover:text-ink"
            >
              Full catalog
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, i) => (
            <Reveal key={product.id} delay={0.08 * i} y={44}>
              <TiltCard
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-paper/70 p-8 shadow-glass backdrop-blur-md"
                max={8}
              >
                <ProductVisual
                  name={product.name}
                  category={product.category}
                  imageUrl={product.imageUrl}
                  className="mb-8"
                />
                <h3 className="text-xl font-light tracking-tight text-ink">{product.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-mute">
                  {product.shortBenefit}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                    {product.sizeLabel}
                  </span>
                  <span className="text-lg font-light text-ink">{inr.format(product.mrpInr)}</span>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
