"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import {
  ShopComingSoonCard,
  ShopEducationCard,
  ShopProductCard
} from "@/components/shop/shop-product-card";
import { cn } from "@/lib/utils";

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
      const pa = (a.pricePaise ?? a.mrpInr * 100) / 100;
      const pb = (b.pricePaise ?? b.mrpInr * 100) / 100;
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
  const totalCount = catalog.length + (featured ? 1 : 0);

  return (
    <>
      {showFeatured ? (
        <Reveal y={24}>
          <div className="mb-2.5">
            <p className="technical !text-ink-soft">Flagship</p>
          </div>
          <ShopProductCard product={featured} featured />
        </Reveal>
      ) : null}

      <div id="formulas" className="mx-auto mt-8 max-w-4xl scroll-mt-28 md:mt-11">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-light tracking-tight text-ink md:text-xl">Browse Formulations</h2>
            <p className="mt-0.5 text-[12px] text-ink-mute">
              {visibleCount} product{visibleCount === 1 ? "" : "s"}
              {q || category ? ` · of ${totalCount}` : ""}
            </p>
          </div>
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border border-ink/12 bg-paper px-2.5 py-1.5 text-[11px] text-ink outline-none"
          >
            <option value="featured">Popular</option>
            <option value="name">Name</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
        </div>

        <label className="relative mb-3 block">
          <span className="sr-only">Search products</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <input
            id="shop-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full border border-ink/12 bg-paper py-2.5 pl-9 pr-3 text-[13px] outline-none ring-gold/25 focus:ring-2"
          />
        </label>

        {categories.length > 0 ? (
          <nav
            aria-label="Product categories"
            className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => setCategory("")}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] transition-colors",
                !category
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/12 bg-paper text-ink-mute active:bg-pearl"
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] transition-colors",
                  category === cat
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/12 bg-paper text-ink-mute active:bg-pearl"
                )}
              >
                {chipLabel(cat)}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {filtered.map((product, i) => (
            <Reveal key={product.id} delay={0.03 * (i % 2)} y={18}>
              <div id={categories.length > 1 ? `cat-${categorySlug(product.category)}` : undefined}>
                <ShopProductCard product={product} />
              </div>
            </Reveal>
          ))}

          {filtered.length === 0 && catalog.length > 0 ? (
            <p className="py-8 text-center text-sm text-ink-mute sm:col-span-2">
              No formulas match your search.
            </p>
          ) : null}

          {catalog.length === 0 ? (
            <>
              <Reveal y={24}>
                <ShopEducationCard
                  label="Research kits"
                  title="Assay-ready fractions"
                  blurb="Partner kits for labs — next release from the SKUAST-K pipeline."
                  href="#pipeline"
                />
              </Reveal>
              <Reveal delay={0.05} y={24}>
                <ShopEducationCard
                  label="Evidence"
                  title="Patent registry"
                  blurb="Codes, jurisdictions, and summaries for every linked formulation."
                  href="#registry"
                />
              </Reveal>
            </>
          ) : catalog.length === 1 && filtered.length <= 1 ? (
            <Reveal delay={0.05} y={24}>
              <ShopEducationCard
                label="Coming soon"
                title="Next formulation"
                blurb="Additional molecules are in discovery. Explore the pipeline for readiness."
                href="#pipeline"
              />
            </Reveal>
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
