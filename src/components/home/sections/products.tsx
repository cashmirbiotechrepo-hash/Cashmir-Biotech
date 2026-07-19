"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { ProductPrice } from "@/components/shop/product-price";
import type { ProductCard } from "@/components/home/content";
import { effectiveSellingPaise, sellingInrFromPaise } from "@/lib/pricing";
import { cn } from "@/lib/utils";

function splitName(name: string): { brand: string; rest: string } {
  const known = ["TaxO", "ZincMag", "Pavitra+", "Pavitra", "Iron Revive", "Cashmir Isabghol", "Dandelion"];
  for (const brand of known) {
    if (name.toLowerCase().startsWith(brand.toLowerCase())) {
      const rest = name.slice(brand.length).replace(/^[\s\-–—:]+/, "").trim();
      return { brand: name.slice(0, brand.length), rest: rest || name };
    }
  }
  const parts = name.split(/\s+/);
  if (parts.length <= 2) return { brand: name, rest: "" };
  return { brand: parts[0], rest: parts.slice(1).join(" ") };
}

function benefitChips(text: string): string[] {
  const cleaned = text
    .replace(/^[^:]+:\s*/, "")
    .replace(/\s+—\s+.+$/, "")
    .replace(/\s+formulated by.+$/i, "");
  const parts = cleaned
    .split(/[,·•|]|(?:\s+and\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 42)
    .map((s) => s.replace(/\s+support$/i, "").replace(/\bsupport\b/gi, "").trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts.slice(0, 3);

  // Fallback: first few words as a single chip-friendly line
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [cleaned.slice(0, 36)];
  return [words.slice(0, 3).join(" "), words.slice(3, 6).join(" ")].filter(Boolean).slice(0, 3);
}

function accentFor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("personal") || c.includes("hair")) return "accent-care";
  if (c.includes("digest")) return "accent-digest";
  if (c.includes("mineral")) return "accent-mineral";
  return "accent-flagship";
}

function hasRealImage(url?: string) {
  return Boolean(url && !url.includes("placeholder"));
}

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

export function Products({ products }: { products: ProductCard[] }) {
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [products]);

  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");

  const visible = useMemo(() => {
    let rows = products.filter((p) => {
      const inCat = filter === "All" || p.category === filter;
      const q = query.trim().toLowerCase();
      const inQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.shortBenefit.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return inCat && inQuery;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "price-asc") {
        return (
          effectiveSellingPaise(a.pricePaise, a.mrpInr) - effectiveSellingPaise(b.pricePaise, b.mrpInr)
        );
      }
      if (sort === "price-desc") {
        return (
          effectiveSellingPaise(b.pricePaise, b.mrpInr) - effectiveSellingPaise(a.pricePaise, a.mrpInr)
        );
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      // featured first, then as provided
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });

    return rows;
  }, [products, filter, query, sort]);

  return (
    <section id="formulations" className="relative py-16 md:py-24">
      <div className="frame">
        <div className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <Reveal>
              <p className="technical mb-3">Shop flagship formulations</p>
            </Reveal>
            <h2 className="text-[clamp(1.85rem,3.6vw,3rem)] font-light leading-[1.08] tracking-tightest">
              <RevealText text="Nutrition, engineered molecule-first." accentWords={[2]} />
            </h2>
            <Reveal delay={0.08}>
              <p className="mt-3 text-sm text-ink-mute md:text-[15px]">
                {products.length} research-backed formulations — priced for direct purchase.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <Link
              href="/products"
              data-cursor="Open"
              className="group inline-flex items-center gap-2 border border-ink/20 bg-paper px-5 py-3 text-sm font-medium text-ink transition-all duration-300 hover:border-gold/50 hover:shadow-glass"
            >
              Browse all products
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={0.05}>
          <div className="mb-6 flex flex-col gap-3 border border-ink/8 bg-paper/60 p-3 backdrop-blur-sm md:flex-row md:items-center md:gap-4">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search products</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="h-10 w-full border border-ink/10 bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-gold/40"
              />
            </label>

            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={cn(
                    "h-9 px-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    filter === cat
                      ? "bg-ink text-paper"
                      : "border border-ink/10 text-ink-mute hover:border-ink/25 hover:text-ink"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-ink-mute md:ml-auto">
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 border border-ink/10 bg-paper px-2 text-sm text-ink outline-none focus:border-gold/40"
              >
                <option value="featured">Popular</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="name">A–Z</option>
              </select>
            </label>
          </div>
        </Reveal>

        {visible.length === 0 ? (
          <p className="border border-dashed border-ink/15 px-4 py-10 text-center text-sm text-ink-mute">
            No products match that filter.{" "}
            <button type="button" className="underline underline-offset-2" onClick={() => { setFilter("All"); setQuery(""); }}>
              Clear filters
            </button>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {visible.map((product, i) => (
              <Reveal key={product.id} delay={0.05 * Math.min(i, 5)} y={28}>
                <HomeProductCard product={product} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function HomeProductCard({ product }: { product: ProductCard }) {
  const href = `/products/${product.slug}`;
  const { brand, rest } = splitName(product.name);
  const chips = benefitChips(product.shortBenefit);
  const accent = accentFor(product.category);
  const realImage = hasRealImage(product.imageUrl);
  const badge = product.featured
    ? "Bestseller"
    : /taxo|zincmag|pavitra/i.test(product.name)
      ? "Flagship"
      : null;

  return (
    <Link
      href={href}
      data-cursor="Open"
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden bg-paper outline-none transition-all duration-500",
        "border border-ink/[0.08] shadow-[0_1px_2px_rgb(17_17_17/0.04)]",
        "hover:-translate-y-1 hover:border-gold/35 hover:shadow-[0_18px_40px_-20px_rgb(17_17_17/0.28)]",
        "focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pearl",
        accent
      )}
    >
      {/* Soft category accent bar */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 opacity-70 transition-opacity group-hover:opacity-100",
          accent === "accent-care" && "bg-[#6b8cae]",
          accent === "accent-digest" && "bg-[#6f8f72]",
          accent === "accent-mineral" && "bg-[#b08a4a]",
          accent === "accent-flagship" && "bg-gold"
        )}
      />

      <div className="relative aspect-[5/4] overflow-hidden bg-white">
        {realImage ? (
          <Image
            src={product.imageUrl!}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain object-center p-5 transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white to-pearl/80">
            <div className="animate-breathe h-20 w-20 rounded-full bg-[radial-gradient(circle_at_34%_30%,rgba(255,255,255,0.95),rgba(209,184,140,0.45)_58%,transparent)]" />
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">Imagery soon</p>
          </div>
        )}

        {badge ? (
          <span className="absolute left-3 top-3 bg-ink px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper">
            {badge}
          </span>
        ) : null}

        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 bg-paper/90 px-2.5 py-1.5 text-[11px] font-medium text-ink opacity-0 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:opacity-100">
          Quick view
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="min-h-[3.25rem]">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">{brand}</p>
          <h3 className="mt-0.5 text-[15px] font-medium leading-snug tracking-tight text-ink sm:text-base">
            {rest || product.name}
          </h3>
        </div>

        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li
              key={chip}
              className="border border-ink/8 bg-pearl/50 px-2 py-0.5 text-[11px] leading-5 text-ink-mute"
            >
              {chip}
            </li>
          ))}
        </ul>

        <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          Research-backed · Made in India
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-ink/8 pt-3">
          <div>
            <ProductPrice
              mrpInr={product.mrpInr}
              sellingInr={sellingInrFromPaise(product.pricePaise, product.mrpInr)}
              compact
            />
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">{product.sizeLabel}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink">
            View product
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
