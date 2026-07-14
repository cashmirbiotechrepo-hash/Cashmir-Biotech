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

export function ShopProductCard({ product, featured = false, className }: Props) {
  const href = `/products/${product.slug}`;
  const badge = product.patent?.patentCode
    ? "Patent-backed"
    : product.featured
      ? "Flagship formulation"
      : product.category;

  if (featured) {
    return (
      <Link
        href={href}
        data-cursor="Open"
        className={cn(
          "group relative grid overflow-hidden bg-paper shadow-glass transition-all duration-500 ease-expo",
          "ring-1 ring-ink/8 hover:-translate-y-0.5 hover:shadow-premium hover:ring-gold/35",
          "md:grid-cols-[0.95fr_1.05fr] md:max-h-[min(58vh,460px)]",
          className
        )}
      >
        <div className="relative aspect-[5/4] overflow-hidden bg-pearl md:aspect-auto md:min-h-[240px]">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 48vw"
              className="object-cover object-center transition-transform duration-700 ease-expo group-hover:scale-[1.03]"
              priority
            />
          ) : null}
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-paper/92 px-3 py-2 text-[12px] font-medium text-ink backdrop-blur-md md:hidden">
            View formula
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="flex flex-col justify-center gap-3 p-5 sm:p-6 md:p-7">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">{badge}</p>
          <h2 className="text-xl font-light tracking-tight text-ink sm:text-[1.65rem]">{product.name}</h2>
          <p className="max-w-sm text-[13px] leading-snug text-ink-mute sm:text-sm">{product.shortBenefit}</p>

          <ul className="mt-1 space-y-1.5">
            {FEATURED_TRUST.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[12px] text-ink-mute">
                <Check className="h-3 w-3 shrink-0 text-gold" strokeWidth={2} />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            <span>{product.category}</span>
            <span aria-hidden>·</span>
            <span>{product.sizeLabel}</span>
            {product.patent?.patentCode ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-gold/80">{product.patent.patentCode}</span>
              </>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-3.5">
            <p className="text-[15px] text-ink">
              <span className="font-light">{inr.format(product.mrpInr)}</span>
            </p>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 group-hover:underline">
              View formula
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-400 ease-expo group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
        "group relative flex h-full flex-col overflow-hidden bg-paper shadow-glass transition-all duration-500 ease-expo",
        "ring-1 ring-ink/8 hover:-translate-y-0.5 hover:shadow-premium hover:ring-gold/35",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-pearl">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover object-center transition-transform duration-700 ease-expo group-hover:scale-[1.03]"
          />
        ) : null}
        <span className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between bg-ink/80 px-3 py-2 text-[11px] font-medium text-paper backdrop-blur-sm transition-transform duration-400 ease-expo group-hover:translate-y-0">
          View formula
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold">{badge}</p>
          {product.patent?.patentCode ? (
            <p className="truncate font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
              {product.patent.patentCode}
            </p>
          ) : null}
        </div>
        <h2 className="mt-1 text-[15px] font-light tracking-tight text-ink sm:text-base">{product.name}</h2>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-mute">{product.shortBenefit}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <p className="text-[13px] text-ink">
            <span className="font-light">{inr.format(product.mrpInr)}</span>
            <span className="mx-1 text-ink-faint">·</span>
            <span className="text-[10px] text-ink-faint">{product.sizeLabel}</span>
          </p>
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">{product.category}</span>
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
      className="group flex h-full flex-col border border-ink/10 bg-paper px-4 py-4 transition-all duration-400 ease-expo hover:border-gold/35 hover:shadow-glass"
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
