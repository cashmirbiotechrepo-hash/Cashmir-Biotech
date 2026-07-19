import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { ProductPrice } from "@/components/shop/product-price";
import { CardQuickAdd } from "@/components/shop/card-quick-add";
import { ProductCardImage } from "@/components/shop/product-card-image";
import { getStockStatus, sellingInrFromPaise } from "@/lib/pricing";
import { isCutoutUrl } from "@/lib/product-image";
import { cn } from "@/lib/utils";

/**
 * Theme-aware "studio" behind the product: a soft ink-based spotlight (reads as
 * a subtle vignette in light mode and a faint glow in dark mode) plus a floor
 * shadow that grounds transparent cutouts. No framed white box.
 */
function StudioBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_62%_54%_at_50%_44%,rgb(var(--ink)/0.05),transparent_74%)]"
      />
      <div
        aria-hidden
        className="absolute bottom-[7%] left-1/2 h-[4.5%] w-[46%] -translate-x-1/2 rounded-[100%] bg-ink/15 blur-[7px]"
      />
    </>
  );
}

export type ShopCardProduct = {
  id: string;
  slug: string;
  name: string;
  shortBenefit: string;
  sizeLabel: string;
  mrpInr: number;
  pricePaise?: number | null;
  imageUrl: string;
  featured: boolean;
  stockQty: number;
  lowStockThreshold?: number;
  category: string;
  patent?: { patentCode: string } | null;
};

const FEATURED_TRUST = ["Patent-backed", "Clinically labelled", "Independent assay"] as const;

type Props = {
  product: ShopCardProduct;
  featured?: boolean;
  className?: string;
};

/**
 * One integrated chip, highest priority wins — stacking labels on a product
 * photo reads like stickers, not merchandising.
 */
function CardBadge({
  product,
  stock,
  featured
}: {
  product: ShopCardProduct;
  stock: ReturnType<typeof getStockStatus>;
  featured?: boolean;
}) {
  let label: string | null = null;
  let tone: "urgent" | "premium" = "premium";

  if (stock === "out_of_stock") {
    label = "Out of stock";
    tone = "urgent";
  } else if (stock === "low_stock") {
    label = "Low stock";
    tone = "urgent";
  } else if (featured) {
    label = "Best seller";
  } else if (product.patent) {
    label = "Patented";
  }

  if (!label) return null;

  return (
    <span
      className={cn(
        "pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full",
        "bg-paper/85 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.12em] backdrop-blur-sm",
        tone === "urgent" ? "text-[#CC0C39]" : "text-ink"
      )}
    >
      <span
        aria-hidden
        className={cn("h-1 w-1 rounded-full", tone === "urgent" ? "bg-[#CC0C39]" : "bg-gold")}
      />
      {label}
    </span>
  );
}

/** Compact shopping card: tight square image → category / name / benefit → price + quick add. */
export function ShopProductCard({ product, featured = false, className }: Props) {
  const href = `/products/${product.slug}`;
  const blurb = product.shortBenefit.replace(/\s+/g, " ").trim();
  const sellingInr = sellingInrFromPaise(product.pricePaise, product.mrpInr);
  const stock = getStockStatus(product.stockQty, product.lowStockThreshold ?? 5);
  const cutout = isCutoutUrl(product.imageUrl);

  const quickAddProduct = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    sizeLabel: product.sizeLabel,
    priceInr: sellingInr,
    imageUrl: product.imageUrl
  };

  if (featured) {
    return (
      <Link
        href={href}
        data-cursor="Open"
        className={cn(
          "group relative grid overflow-hidden rounded-sm bg-paper shadow-sm transition-[transform,box-shadow] duration-300 ease-out",
          "active:scale-[0.99] md:grid-cols-[minmax(0,300px)_1fr]",
          "md:hover:-translate-y-1 md:hover:shadow-premium",
          className
        )}
      >
        <div className="relative aspect-square overflow-hidden md:aspect-auto md:min-h-[240px]">
          <StudioBackdrop />
          {product.imageUrl ? (
            <ProductCardImage
              src={product.imageUrl}
              alt={product.name}
              sizes="(max-width: 768px) 100vw, 300px"
              priority
              className={cn(
                "object-contain object-center transition-transform duration-700 ease-expo",
                cutout
                  ? "p-[10%] pb-[12%] [filter:drop-shadow(0_14px_16px_rgb(var(--ink)/0.16))] group-hover:scale-[1.04]"
                  : "scale-[1.16] mix-blend-multiply group-hover:scale-[1.22] dark:mix-blend-normal"
              )}
            />
          ) : null}
          <CardBadge product={product} stock={stock} featured />
        </div>

        <div className="flex flex-col justify-center gap-2 px-4 py-4 sm:px-5 md:gap-2.5 md:py-5">
          <p className="text-[11px] uppercase tracking-[0.1em] text-ink-soft">{product.category}</p>

          <h2 className="line-clamp-2 text-[1.3rem] font-light tracking-tight text-ink md:text-[1.5rem]">
            {product.name}
          </h2>
          <p className="line-clamp-2 max-w-md text-[13px] leading-snug text-ink-mute">{blurb}</p>

          <ul className="mt-0.5 hidden gap-x-4 gap-y-1 md:flex md:flex-wrap">
            {FEATURED_TRUST.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-[11.5px] text-ink-mute">
                <Check className="h-3 w-3 shrink-0 text-gold" strokeWidth={2} />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3 pt-2">
            <ProductPrice
              mrpInr={product.mrpInr}
              sellingInr={sellingInr}
              sizeLabel={product.sizeLabel}
              compact
            />
            <div className="flex items-center gap-2">
              <CardQuickAdd product={quickAddProduct} available={product.stockQty} variant="wide" />
              <span className="inline-flex h-10 items-center gap-1.5 bg-ink px-4 text-[12px] font-medium text-paper">
                View
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      data-cursor="Open"
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-sm bg-paper transition-[transform,box-shadow] duration-300 ease-out",
        "active:scale-[0.985] md:hover:-translate-y-1 md:hover:shadow-premium",
        className
      )}
    >
      {/* The card *is* the studio: no framed image box, product staged on the card surface. */}
      <div className="relative aspect-square overflow-hidden">
        <StudioBackdrop />
        {product.imageUrl ? (
          <ProductCardImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-contain object-center transition-transform duration-700 ease-expo",
              cutout
                ? "p-[9%] pb-[12%] [filter:drop-shadow(0_12px_14px_rgb(var(--ink)/0.16))] group-hover:scale-[1.04]"
                : "scale-[1.28] mix-blend-multiply group-hover:scale-[1.34] dark:mix-blend-normal"
            )}
          />
        ) : null}
        <CardBadge product={product} stock={stock} />
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <h2 className="line-clamp-1 text-[14px] font-medium leading-snug tracking-tight text-ink">
          {product.name}
        </h2>
        <p className="mt-0.5 line-clamp-1 text-[11.5px] leading-snug text-ink-mute">
          {blurb}
          {product.sizeLabel ? <span className="text-ink-faint"> · {product.sizeLabel}</span> : null}
        </p>
        {product.patent ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-gold">
            <Check className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} aria-hidden />
            Patent-backed
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <ProductPrice mrpInr={product.mrpInr} sellingInr={sellingInr} compact />
          <CardQuickAdd
            product={quickAddProduct}
            available={product.stockQty}
            className="md:opacity-70 md:transition-opacity md:group-hover:opacity-100"
          />
        </div>
      </div>
    </Link>
  );
}

type PipelineProps = {
  title: string;
  blurb: string;
  status: string;
  year: string;
  molecule: string;
  category: string;
  readiness: number;
  partner: string;
};

export function ShopComingSoonCard({
  title,
  blurb,
  status,
  year,
  molecule,
  category,
  readiness,
  partner
}: PipelineProps) {
  return (
    <div className="flex h-full flex-col border border-ink/12 bg-pearl/40 px-4 py-4 transition-colors hover:border-gold/35 hover:bg-paper">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold">{status}</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">{year}</p>
      </div>
      <h3 className="mt-2.5 text-base font-light tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-snug text-ink-mute">{blurb}</p>

      <div className="mt-3">
        <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          <span>Readiness</span>
          <span className="text-ink-soft">{readiness}%</span>
        </div>
        <div className="h-px w-full bg-ink/10">
          <div className="h-px bg-gold" style={{ width: `${readiness}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-ink/8 pt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
        <span>{molecule}</span>
        <span aria-hidden>·</span>
        <span>{category}</span>
        <span aria-hidden>·</span>
        <span>{partner}</span>
      </div>
    </div>
  );
}

/** Educational / abundance filler when the live catalog is thin. */
export function ShopEducationCard({
  title,
  blurb,
  href,
  label
}: {
  title: string;
  blurb: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col border border-ink/10 bg-paper px-4 py-4 transition-all duration-400 ease-expo hover:border-gold/35"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">{label}</p>
      <h3 className="mt-2 text-base font-light tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-snug text-ink-mute">{blurb}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-ink">
        Explore
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
