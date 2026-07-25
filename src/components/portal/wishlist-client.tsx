"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/shop/cart-context";
import { removeWishlistAction } from "@/app/(portal)/portal/(session)/actions";

export type WishlistRow = {
  productId: string;
  slug: string;
  name: string;
  sizeLabel: string;
  priceInr: number;
  imageUrl: string;
  maxQty: number;
  available: boolean;
};

export function WishlistClient({ items }: { items: WishlistRow[] }) {
  const { add, ready } = useCart();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-ink/15 bg-paper/60 px-4 py-10 text-center">
        <p className="text-[15px] text-ink">No saved products yet</p>
        <p className="mt-1 text-[13px] text-ink-mute">Tap the heart on a product page to save it here.</p>
        <Link
          href="/products"
          className="mt-5 inline-flex min-h-11 items-center justify-center bg-ink px-6 text-[13px] font-medium text-paper"
        >
          Browse catalog
        </Link>
      </div>
    );
  }

  const available = items.filter((i) => i.available);

  return (
    <div className="space-y-4">
      {available.length > 0 ? (
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            for (const item of available) {
              add(
                {
                  productId: item.productId,
                  slug: item.slug,
                  name: item.name,
                  sizeLabel: item.sizeLabel,
                  priceInr: item.priceInr,
                  imageUrl: item.imageUrl,
                  maxQty: item.maxQty
                },
                1
              );
            }
            setMessage(`Added ${available.length} item${available.length === 1 ? "" : "s"} to cart.`);
            window.setTimeout(() => router.push("/cart"), 350);
          }}
          className="inline-flex min-h-11 w-full items-center justify-center bg-ink text-[13px] font-medium text-paper sm:w-auto sm:px-6"
        >
          Add all to cart
        </button>
      ) : null}
      {message ? <p className="text-[12px] text-ink-mute">{message}</p> : null}

      <ul className="divide-y divide-ink/8 border border-ink/10 bg-paper">
        {items.map((item) => (
          <li key={item.productId} className="flex gap-3 px-3 py-3">
            <Link href={`/products/${item.slug}`} className="relative h-14 w-14 shrink-0 overflow-hidden bg-pearl">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/products/${item.slug}`} className="text-[14px] font-medium text-ink hover:underline">
                {item.name}
              </Link>
              <p className="mt-0.5 text-[12px] text-ink-mute">
                {item.sizeLabel}
                {!item.available ? " · Unavailable" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                {item.available ? (
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => {
                      add(
                        {
                          productId: item.productId,
                          slug: item.slug,
                          name: item.name,
                          sizeLabel: item.sizeLabel,
                          priceInr: item.priceInr,
                          imageUrl: item.imageUrl,
                          maxQty: item.maxQty
                        },
                        1
                      );
                      setMessage("Added to cart.");
                    }}
                    className="text-ink underline-offset-4 hover:underline"
                  >
                    Add to cart
                  </button>
                ) : null}
                <form action={removeWishlistAction.bind(null, item.productId)}>
                  <button type="submit" className="text-ink-mute hover:text-ink">
                    Remove
                  </button>
                </form>
              </div>
            </div>
            <p className="text-[13px] tabular-nums text-ink">₹{item.priceInr}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
