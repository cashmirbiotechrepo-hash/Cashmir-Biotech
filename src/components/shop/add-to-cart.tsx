"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Minus, Plus } from "lucide-react";
import { useCart } from "@/components/shop/cart-context";
import { SITE_CONTACT } from "@/lib/site-contact";
import { cn } from "@/lib/utils";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";

type AddToCartProps = {
  product: {
    productId: string;
    slug: string;
    name: string;
    sizeLabel: string;
    priceInr: number;
    imageUrl: string;
  };
  available: number;
  priceLabel: string;
  className?: string;
};

const control =
  "h-12 transition-colors duration-300 ease-expo disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Single purchase block — no sticky/floating duplicate dock.
 * (Lenis transform breaks `position: fixed`, which caused mid-page overlap.)
 */
export function AddToCart({ product, available, className }: AddToCartProps) {
  const { add, items } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const inCart = items.find((i) => i.productId === product.productId)?.quantity ?? 0;
  const cap = Math.max(0, Math.min(available, 20));
  const soldOut = available <= 0;
  const remaining = Math.max(0, cap - inCart);

  const handleAdd = () => {
    if (soldOut || remaining <= 0) return;
    add({ ...product, maxQty: cap }, Math.min(qty, remaining));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (soldOut || remaining <= 0) return;
    add({ ...product, maxQty: cap }, Math.min(qty, remaining));
    router.push("/checkout");
  };

  if (soldOut) {
    return (
      <div className={className}>
        <button type="button" disabled className={cn(control, "w-full bg-ink/5 text-[13px] text-ink-faint")}>
          Currently unavailable
        </button>
        <a
          href={`mailto:${SITE_CONTACT.primaryEmail}?subject=${encodeURIComponent(`Restock: ${product.name}`)}`}
          className="mt-3 block text-center text-[12px] text-ink-mute underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Ask to be notified when it returns
        </a>
      </div>
    );
  }

  const qtyControl = (
    <div className="flex shrink-0 items-center ring-1 ring-ink/15 ring-inset">
      <button
        type="button"
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        disabled={qty <= 1}
        aria-label="Decrease quantity"
        className={cn(control, "w-11 text-ink")}
      >
        <Minus className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <span className="w-8 text-center text-sm tabular-nums text-ink">{qty}</span>
      <button
        type="button"
        onClick={() => setQty((q) => Math.min(remaining || cap, q + 1))}
        disabled={qty >= (remaining || cap)}
        aria-label="Increase quantity"
        className={cn(control, "w-11 text-ink")}
      >
        <Plus className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );

  const buyBtn = (
    <button
      type="button"
      onClick={handleBuyNow}
      disabled={remaining <= 0}
      className={cn(
        control,
        "flex flex-1 items-center justify-center bg-ink text-[13px] font-medium tracking-[0.01em] text-paper"
      )}
    >
      Buy now
    </button>
  );

  const addBtn = (
    <button
      type="button"
      onClick={handleAdd}
      disabled={remaining <= 0}
      className={cn(
        control,
        "relative flex flex-1 items-center justify-center text-[13px] font-medium tracking-[0.01em] text-ink ring-1 ring-ink/20 ring-inset hover:ring-ink/50"
      )}
    >
      <motion.span
        key={added ? "added" : "add"}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
        className="flex items-center gap-2"
      >
        {added ? (
          <>
            <Check className="h-3.5 w-3.5" strokeWidth={2} /> Added
          </>
        ) : remaining <= 0 ? (
          "Max in cart"
        ) : (
          "Add to cart"
        )}
      </motion.span>
    </button>
  );

  return (
    <div className={className}>
      {/* Mobile: qty + Buy, then Add — one place only */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        <div className="flex items-stretch gap-2">
          {qtyControl}
          {buyBtn}
        </div>
        {addBtn}
      </div>

      {/* Desktop: single row */}
      <div className="hidden items-stretch gap-2 sm:flex">
        {qtyControl}
        {buyBtn}
        {addBtn}
      </div>

      {inCart > 0 ? (
        <p className="mt-3 text-[12px] text-ink-mute">
          <Link href="/cart" className="text-ink underline-offset-4 hover:underline">
            {inCart} in cart · View
          </Link>
        </p>
      ) : null}
    </div>
  );
}
