"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import {
  ShopComingSoonCard,
  ShopEducationCard,
  ShopProductCard
} from "@/components/shop/shop-product-card";
import { cn } from "@/lib/utils";
import { effectiveSellingPaise } from "@/lib/pricing";

type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  shortBenefit: string;
  description: string;
  mrpInr: number;
  pricePaise: number | null;
  sizeLabel: string;
  category: string;
  imageUrl: string;
  images: string[];
  sku: string;
  stockQty: number;
  lowStockThreshold?: number;
  featured: boolean;
  patent?: { patentCode: string; title: string } | null;
};

function categorySlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function chipLabel(cat: string) {
  if (/personal care/i.test(cat)) return "Hair & Care";
  if (/digestive/i.test(cat)) return "Digestive";
  if (/functional/i.test(cat)) return "Supplements";
  if (/mineral/i.test(cat)) return "Minerals";
  return cat;
}

export function ShopCatalog({
  featured,
  catalog,
  categories
}: {
  featured: CatalogProduct | null;
  catalog: CatalogProduct[];
  categories: string[];
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"featured" | "price-asc" | "price-desc" | "name">("featured");

  const allProducts = useMemo(
    () => (featured ? [featured, ...catalog] : catalog),
    [featured, catalog]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allProducts) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return counts;
  }, [allProducts]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = catalog.filter((p) => {
      if (category && p.category !== category) return false;
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.shortBenefit.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
      );
    });

    list = [...list].sort((a, b) => {
      const pa = effectiveSellingPaise(a.pricePaise, a.mrpInr) / 100;
      const pb = effectiveSellingPaise(b.pricePaise, b.mrpInr) / 100;
      if (sort === "price-asc") return pa - pb;
      if (sort === "price-desc") return pb - pa;
      if (sort === "name") return a.name.localeCompare(b.name);
      return Number(b.featured) - Number(a.featured);
    });
    return list;
  }, [catalog, category, q, sort]);

  const showFeatured =
    featured &&
    !q.trim() &&
    (!category || featured.category === category) &&
    sort === "featured";

  const visibleCount = filtered.length + (showFeatured ? 1 : 0);
  const totalCount = allProducts.length;
  const isFiltering = Boolean(q.trim() || category);

  return (
    <>
      {showFeatured ? (
        <Reveal y={20}>
          <ShopProductCard product={featured} featured />
        </Reveal>
      ) : null}

      <div id="formulas" className="mt-5 scroll-mt-36 md:mt-6">
        {/* One sticky toolbar: search · sort · count · category chips */}
        <div className="sticky top-[4.5rem] z-30 -mx-1 mb-4 border-b border-ink/8 bg-paper/95 px-1 pb-2.5 pt-2 backdrop-blur-md md:top-[4.75rem]">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search products</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <input
                id="shop-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search formulas"
                className="w-full border border-ink/12 bg-paper py-2 pl-9 pr-8 text-[13px] outline-none ring-gold/25 focus:ring-2"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>

            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-[38px] shrink-0 border border-ink/12 bg-paper px-2.5 text-[12px] text-ink outline-none ring-gold/25 focus:ring-2"
            >
              <option value="featured">Popular</option>
              <option value="name">Name</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>

            <p className="hidden shrink-0 text-[12px] tabular-nums text-ink-mute sm:block" aria-live="polite">
              {visibleCount}
              {isFiltering ? ` of ${totalCount}` : ""} product{visibleCount === 1 ? "" : "s"}
            </p>
          </div>

          {categories.length > 1 ? (
            <nav
              aria-label="Product categories"
              className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                onClick={() => setCategory("")}
                aria-pressed={!category}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-[3px] text-[11px] transition-colors",
                  !category
                    ? "bg-ink text-paper"
                    : "bg-pearl text-ink-mute hover:bg-mist hover:text-ink"
                )}
              >
                All <span className={cn("tabular-nums", !category ? "text-paper/60" : "text-ink-faint")}>{totalCount}</span>
              </button>
              {categories.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(active ? "" : cat)}
                    aria-pressed={active}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-[3px] text-[11px] transition-colors",
                      active
                        ? "bg-ink text-paper"
                        : "bg-pearl text-ink-mute hover:bg-mist hover:text-ink"
                    )}
                  >
                    {chipLabel(cat)}{" "}
                    <span className={cn("tabular-nums", active ? "text-paper/60" : "text-ink-faint")}>
                      {categoryCounts.get(cat) ?? 0}
                    </span>
                  </button>
                );
              })}
            </nav>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:gap-x-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product, i) => (
            <Reveal key={product.id} delay={0.025 * (i % 4)} y={14}>
              <div
                className="h-full"
                id={categories.length > 1 ? `cat-${categorySlug(product.category)}` : undefined}
              >
                <ShopProductCard product={product} />
              </div>
            </Reveal>
          ))}

          {filtered.length === 0 && catalog.length > 0 ? (
            <div className="col-span-full py-10 text-center">
              <p className="text-sm text-ink-mute">No formulas match your search.</p>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setCategory("");
                }}
                className="mt-2 text-[13px] font-medium text-ink underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {catalog.length === 0 ? (
            <>
              <Reveal y={20}>
                <ShopEducationCard
                  label="Research kits"
                  title="Assay-ready fractions"
                  blurb="Partner kits for labs — next release from the SKUAST-K pipeline."
                  href="#pipeline"
                />
              </Reveal>
              <Reveal delay={0.05} y={20}>
                <ShopEducationCard
                  label="Evidence"
                  title="Patent registry"
                  blurb="Codes, jurisdictions, and summaries for every linked formulation."
                  href="#registry"
                />
              </Reveal>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function ShopPipelineCards({
  items
}: {
  items: Array<{
    title: string;
    blurb: string;
    status: string;
    year: string;
    molecule: string;
    category: string;
    readiness: number;
    partner: string;
  }>;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl">
      {items.map((item, i) => (
        <Reveal key={item.title} delay={0.04 * i} y={18}>
          <ShopComingSoonCard {...item} />
        </Reveal>
      ))}
    </div>
  );
}
