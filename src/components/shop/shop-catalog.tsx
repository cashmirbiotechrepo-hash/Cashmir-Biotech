"use client";

import { useMemo, useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import {
  ShopComingSoonCard,
  ShopEducationCard,
  ShopProductCard
} from "@/components/shop/shop-product-card";

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

  return (
    <>
      {showFeatured ? (
        <Reveal y={24}>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className="technical !text-ink-soft">Flagship formulation</p>
            {featured.patent?.patentCode ? (
              <p className="font-mono text-[10px] text-ink-soft">{featured.patent.patentCode}</p>
            ) : null}
          </div>
          <ShopProductCard product={featured} featured />
        </Reveal>
      ) : null}

      <div id="formulas" className="mx-auto mt-9 max-w-4xl scroll-mt-28 md:mt-11">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="technical mb-0.5 !text-ink-soft">All formulas</p>
            <h2 className="text-lg font-light tracking-tight text-ink">The catalog</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="shop-search">
              Search products
            </label>
            <input
              id="shop-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search formulas…"
              className="min-w-[10rem] flex-1 rounded-full border border-ink/15 bg-paper px-3 py-2 text-[13px] outline-none ring-gold/30 focus:ring-2 sm:max-w-[14rem]"
            />
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-full border border-ink/15 bg-paper px-3 py-2 text-[12px] outline-none"
            >
              <option value="featured">Featured</option>
              <option value="name">Name</option>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
            </select>
          </div>
        </div>

        {categories.length > 0 ? (
          <nav aria-label="Product categories" className="mb-4 flex flex-wrap gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setCategory("")}
              className={`font-mono text-[10px] uppercase tracking-[0.14em] underline-offset-4 hover:underline ${
                !category ? "text-ink" : "text-ink-mute hover:text-ink"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`font-mono text-[10px] uppercase tracking-[0.14em] underline-offset-4 hover:underline ${
                  category === cat ? "text-ink" : "text-ink-mute hover:text-ink"
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((product, i) => (
            <Reveal key={product.id} delay={0.04 * (i % 2)} y={24}>
              <div id={categories.length > 1 ? `cat-${categorySlug(product.category)}` : undefined}>
                <ShopProductCard product={product} />
              </div>
            </Reveal>
          ))}

          {filtered.length === 0 && catalog.length > 0 ? (
            <p className="sm:col-span-2 py-8 text-center text-sm text-ink-mute">
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
