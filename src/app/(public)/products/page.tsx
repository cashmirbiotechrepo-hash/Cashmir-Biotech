import { Header2 } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { listActiveProducts } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import type { Product } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Products · Cashmir Biotech" };

export default async function ProductsPage() {
  let products: Product[] = [];
  try {
    products = await listActiveProducts();
  } catch (error) {
    logger.error({ event: "products_fetch_failed", err: error }, "failed to load products");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Header2 />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-brand">Catalog</p>
        <h1 className="mb-10 mt-2 text-4xl font-bold [font-family:var(--font-headline)]">Product Catalog</h1>
        {products.length === 0 ? (
          <p className="text-on-muted">No products are available right now. Please check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <article
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low transition-all duration-300 hover:border-primary/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- image URLs are admin-managed and may point to any host */}
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    loading="lazy"
                    className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-brand">{p.category}</p>
                  <h2 className="mt-2 text-xl font-semibold [font-family:var(--font-headline)]">{p.name}</h2>
                  <p className="mt-1 text-sm text-primary-brand">{p.shortBenefit}</p>
                  <p className="mt-2 text-sm leading-relaxed text-on-muted line-clamp-3">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-4">
                    <p className="font-semibold text-primary-brand">MRP ₹{p.mrpInr.toLocaleString("en-IN")}</p>
                    <p className="text-xs uppercase tracking-wider text-on-muted">{p.sizeLabel}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
