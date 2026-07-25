"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/shop/cart-context";

export type BuyAgainLine = {
  productId: string;
  slug: string;
  name: string;
  sizeLabel: string;
  priceInr: number;
  imageUrl: string;
  quantity: number;
  maxQty: number;
  available: boolean;
};

export function BuyAgainButton({ lines }: { lines: BuyAgainLine[] }) {
  const { add, ready } = useCart();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const available = lines.filter((l) => l.available);
  if (available.length === 0) {
    return (
      <p className="text-[13px] text-ink-mute sm:col-span-2">
        Items from this order are no longer available to reorder.
      </p>
    );
  }

  return (
    <div className="sm:col-span-2 space-y-2">
      <button
        type="button"
        disabled={!ready || pending}
        onClick={() => {
          setPending(true);
          let added = 0;
          for (const line of available) {
            add(
              {
                productId: line.productId,
                slug: line.slug,
                name: line.name,
                sizeLabel: line.sizeLabel,
                priceInr: line.priceInr,
                imageUrl: line.imageUrl,
                maxQty: line.maxQty
              },
              line.quantity
            );
            added += 1;
          }
          const skipped = lines.length - available.length;
          setMessage(
            skipped > 0
              ? `Added ${added} item${added === 1 ? "" : "s"}; ${skipped} unavailable.`
              : `Added ${added} item${added === 1 ? "" : "s"} to cart.`
          );
          setPending(false);
          window.setTimeout(() => router.push("/cart"), 400);
        }}
        className="inline-flex min-h-11 w-full items-center justify-center bg-ink text-[13px] font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Adding…" : available.length === lines.length ? "Buy again" : "Buy available again"}
      </button>
      {message ? (
        <p role="status" className="text-center text-[12px] text-ink-mute">
          {message}
        </p>
      ) : null}
    </div>
  );
}
