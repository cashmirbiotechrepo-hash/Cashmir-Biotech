import { getPricingDisplay } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

type Props = {
  mrpInr: number;
  sellingInr: number;
  /** Smaller spacing / type for cards */
  compact?: boolean;
  className?: string;
  sizeLabel?: string;
};

/** Amazon-style price block: -43%  ₹340 / struck MRP */
export function ProductPrice({ mrpInr, sellingInr, compact = false, className, sizeLabel }: Props) {
  const { hasDiscount, discountPercent, showStruckMrp, showBadge } = getPricingDisplay(
    mrpInr,
    sellingInr
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", compact ? "gap-x-1.5" : "gap-x-2.5")}>
        {showBadge ? (
          <span
            className={cn(
              "font-semibold text-[#CC0C39]",
              compact ? "text-[13px]" : "text-[15px] sm:text-base"
            )}
          >
            -{discountPercent}%
          </span>
        ) : null}
        <span
          className={cn(
            "font-light tracking-tight text-ink",
            compact ? "text-[1.15rem]" : "text-[1.45rem] sm:text-[1.55rem]"
          )}
        >
          <span className={cn("relative -top-[0.35em] mr-0.5 font-normal", compact ? "text-[0.65em]" : "text-[0.55em]")}>
            ₹
          </span>
          {Math.round(sellingInr).toLocaleString("en-IN")}
        </span>
        {sizeLabel ? (
          <span className={cn("text-ink-faint", compact ? "text-[10px]" : "text-[12px]")}>{sizeLabel}</span>
        ) : null}
      </div>
      {showStruckMrp ? (
        <p className={cn("mt-0.5 text-ink-mute", compact ? "text-[11px]" : "text-[12px]")}>
          M.R.P.: <span className="line-through">{inr.format(mrpInr)}</span>
        </p>
      ) : null}
      {!hasDiscount && !compact ? (
        <p className="sr-only">No discount — selling price equals MRP.</p>
      ) : null}
    </div>
  );
}
