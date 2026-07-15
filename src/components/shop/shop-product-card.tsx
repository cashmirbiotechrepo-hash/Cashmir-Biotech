import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShopCardProduct = {
  id: string;
  slug: string;
  name: string;
  shortBenefit: string;
  sizeLabel: string;
  mrpInr: number;
  imageUrl: string;
  featured: boolean;
  stockQty: number;
  category: string;
  patent?: { patentCode: string } | null;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const FEATURED_TRUST = ["Patent-backed", "Clinically labelled", "Independent assay"] as const;

type Props = {
  product: ShopCardProduct;
  featured?: boolean;
  className?: string;
};

/** One continuous shopping object: portrait bottle → essentials → price + CTA. */
export function ShopProductCard({ product, featured = false, className }: Props) {
  const href = `/products/${product.slug}`;
  const blurb = product.shortBenefit.replace(/\s+/g, " ").trim();

  if (featured) {
    return (
      <Link
        href={href}
        data-cursor="Open"
        className={cn(
          "group relative grid overflow-hidden bg-paper transition-[transform,box-shadow] duration-300 ease-out",
          "border border-ink/10 active:scale-[0.985] md:grid-cols-[0.9fr_1.1fr]",
          "md:hover:-translate-y-0.5 md:hover:shadow-premium md:hover:border-ink/15",
          className
        )}
      >
        <div className="relative aspect-[4/5] bg-pearl md:aspect-auto md:min-h-[280px]">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 42vw"
              className="object-contain object-center p-5 transition-transform duration-700 ease-expo group-hover:scale-[1.02] md:p-8"
              priority
            />
          ) : null}
        </div>

        <div className="flex flex-col justify-center gap-2.5 px-4 pb-4 pt-3 sm:px-5 md:gap-3 md:p-7">
          {product.patent ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-gold">
              <Check className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
              Patent-backed
            </p>
          ) : (
            <p className="text-[11px] text-ink-soft">{product.category}</p>
          )}

          <h2 className="line-clamp-2 text-[1.35rem] font-light tracking-tight text-ink md:text-[1.65rem]">
            {product.name}
          </h2>
          <p className="line-clamp-2 max-w-sm text-[13px] leading-snug text-ink-mute">{blurb}</p>

          <ul className="mt-1 hidden space-y-1.5 md:block">
            {FEATURED_TRUST.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[12px] text-ink-mute">
                <Check className="h-3 w-3 shrink-0 text-gold" strokeWidth={2} />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink/8 pt-3.5">
            <div>
              <p className="text-[1.35rem] font-light tracking-tight text-ink md:text-[1.5rem]">
                {inr.format(product.mrpInr)}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">{product.sizeLabel}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
              View Product
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
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
        "group relative flex h-full flex-col overflow-hidden bg-paper transition-[transform,box-shadow] duration-300 ease-out",
        "border border-ink/10 active:scale-[0.985]",
        "md:hover:-translate-y-0.5 md:hover:shadow-premium md:hover:border-ink/15",
        className
      )}
    >
      {/* Portrait frame — bottles fill ~80% with soft margins, not a square crop */}
      <div className="relative aspect-[4/5] bg-pearl">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-contain object-center p-4 transition-transform duration-700 ease-expo group-hover:scale-[1.03] sm:p-5"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        {product.patent ? (
          <p className="mb-1.5 inline-flex items-center gap-1 text-[10px] text-gold">
            <Check className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} aria-hidden />
            Patent-backed
          </p>
        ) : null}

        <h2 className="line-clamp-2 text-[16px] font-light leading-snug tracking-tight text-ink">
          {product.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-mute">{blurb}</p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-ink/8 pt-3">
          <div className="min-w-0">
            <p className="text-[1.2rem] font-light tracking-tight text-ink">{inr.format(product.mrpInr)}</p>
            <p className="mt-0.5 truncate text-[10px] text-ink-faint">
              {product.sizeLabel}
              <span className="mx-1 text-ink/20">·</span>
              {product.category}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink">
            View Product
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
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
