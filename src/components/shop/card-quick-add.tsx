"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/components/shop/cart-context";
import { cn } from "@/lib/utils";

type Props = {
  product: {
    productId: string;
    slug: string;
    name: string;
    sizeLabel: string;
    priceInr: number;
    imageUrl: string;
  };
  available: number;
  /** "icon" = compact square button for grid cards; "wide" = labelled button for the featured card. */
  variant?: "icon" | "wide";
  className?: string;
};

/** One-tap add-to-cart for catalog cards. Lives inside the card <Link>, so it swallows the click. */
export function CardQuickAdd({ product, available, variant = "icon", className }: Props) {
  const { add, items } = useCart();
  const [added, setAdded] = useState(false);

  const inCart = items.find((i) => i.productId === product.productId)?.quantity ?? 0;
  const cap = Math.max(0, Math.min(available, 20));
  const disabled = available <= 0 || inCart >= cap;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    add({ ...product, maxQty: cap }, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  if (variant === "wide") {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        aria-label={`Add ${product.name} to cart`}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 px-4 text-[12px] font-medium text-ink",
          "ring-1 ring-ink/20 ring-inset transition-colors hover:ring-ink/50",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
      >
        {added ? (
          <>
            <Check className="h-3.5 w-3.5" strokeWidth={2} /> Added
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add to cart
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={disabled}
      aria-label={`Add ${product.name} to cart`}
      title={disabled ? "Unavailable" : "Add to cart"}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center transition-colors duration-200",
        added
          ? "bg-ink text-paper"
          : "text-ink ring-1 ring-ink/15 ring-inset hover:bg-ink hover:text-paper",
        "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink",
        className
      )}
    >
      {added ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
      ) : (
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}
