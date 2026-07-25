import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer/auth";
import { listWishlist } from "@/lib/customer/wishlist";
import { WishlistClient } from "@/components/portal/wishlist-client";

export const metadata: Metadata = {
  title: "Wishlist · Customer Portal",
  robots: { index: false, follow: false }
};

function priceInr(p: { pricePaise: number | null; mrpInr: number }) {
  if (p.pricePaise && p.pricePaise > 0) return Math.round(p.pricePaise / 100);
  return p.mrpInr;
}

export default async function PortalWishlistPage() {
  const session = await requireCustomerSession();
  const rows = await listWishlist(session.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-[13px] text-ink-mute">
          <Link href="/portal/account" className="hover:text-ink hover:underline">
            Account
          </Link>
          <span className="mx-1.5 text-ink-faint">/</span>
          Wishlist
        </p>
        <h1 className="mt-1 text-[1.65rem] font-light tracking-tight text-ink">Wishlist</h1>
        <p className="mt-1 text-[13px] text-ink-mute">Products you saved for later.</p>
      </header>

      <WishlistClient
        items={rows.map((r) => ({
          productId: r.product.id,
          slug: r.product.slug,
          name: r.product.name,
          sizeLabel: r.product.sizeLabel,
          priceInr: priceInr(r.product),
          imageUrl: r.product.imageUrl,
          maxQty: Math.max(1, Math.min(r.product.maxOrderQty ?? 20, 20)),
          available: r.product.active
        }))}
      />
    </div>
  );
}
