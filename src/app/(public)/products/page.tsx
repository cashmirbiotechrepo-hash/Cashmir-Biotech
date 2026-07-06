import Image from "next/image";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { listActiveProducts } from "@/modules/cms/services/content.service";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listActiveProducts();

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="mb-10 text-4xl font-bold">Product Catalog</h1>
        <div className="grid gap-6 md:grid-cols-3">
          {products.map((p) => (
            <article key={p.id} className="rounded-xl bg-surface-container-low p-4">
              <Image src={p.imageUrl} alt={p.name} width={900} height={900} className="h-56 w-full rounded-lg object-cover" />
              <h2 className="mt-3 text-xl font-semibold">{p.name}</h2>
              <p className="text-sm text-neutral-500">{p.description}</p>
              <p className="mt-2 text-primary-brand">MRP ₹{p.mrpInr}</p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
