import { Header2 } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { listActiveProducts } from "@/modules/cms/services/content.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Products · Cashmir Biotech" };

export default async function ProductsPage() {
  const products = await listActiveProducts();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Header2 />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-primary-brand">Catalog</p>
        <h1 className="mb-10 mt-2 text-4xl font-bold [font-family:var(--font-headline)]">Product Catalog</h1>
        {products.length === 0 ? (
          <p className="text-neutral-500">No products are available right now. Please check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {products.map((p) => (
              <article key={p.id} className="rounded-xl bg-surface-container-low p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- image URLs are admin-managed and may point to any host */}
                <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-56 w-full rounded-lg object-cover" />
                <h2 className="mt-3 text-xl font-semibold">{p.name}</h2>
                <p className="mt-1 text-sm text-primary-brand">{p.shortBenefit}</p>
                <p className="mt-2 text-sm text-neutral-500">{p.description}</p>
                <p className="mt-3 font-semibold text-primary-brand">
                  MRP ₹{p.mrpInr} · {p.sizeLabel}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
