"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/app/(portal)/portal/(session)/actions";
import { cn } from "@/lib/utils";

export function WishlistToggle({
  productId,
  initialWishlisted,
  loggedIn,
  loginHref,
  className
}: {
  productId: string;
  initialWishlisted: boolean;
  loggedIn: boolean;
  loginHref: string;
  className?: string;
}) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [pending, startTransition] = useTransition();

  if (!loggedIn) {
    return (
      <a
        href={loginHref}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 border border-ink/15 px-4 text-[13px] font-medium text-ink",
          className
        )}
      >
        <Heart className="h-4 w-4" strokeWidth={1.6} />
        Save to wishlist
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const prev = wishlisted;
          setWishlisted(!prev);
          const res = await toggleWishlistAction(productId);
          if (!res.ok) {
            setWishlisted(prev);
            return;
          }
          setWishlisted(res.wishlisted);
          router.refresh();
        });
      }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 border border-ink/15 px-4 text-[13px] font-medium text-ink disabled:opacity-60",
        wishlisted && "border-gold/40 bg-gold/10",
        className
      )}
      aria-pressed={wishlisted}
    >
      <Heart
        className={cn("h-4 w-4", wishlisted && "fill-gold text-gold")}
        strokeWidth={1.6}
      />
      {wishlisted ? "Saved" : "Save to wishlist"}
    </button>
  );
}
