import { Header2 } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { listPatents } from "@/modules/cms/services/content.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Patents & Research · Cashmir Biotech" };

export default async function PatentsPage() {
  const patents = await listPatents();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Header2 />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-primary-brand">Proof Layer</p>
        <h1 className="mb-10 mt-2 text-4xl font-bold [font-family:var(--font-headline)]">Patents & Scientific Registry</h1>
        {patents.length === 0 ? (
          <p className="text-neutral-500">No patents have been published yet. Please check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {patents.map((p) => (
              <article key={p.id} className="rounded-xl bg-surface-container-low p-6">
                <p className="text-xs uppercase tracking-[0.15em] text-primary-brand">{p.patentCode}</p>
                <h2 className="mt-2 text-2xl font-semibold">{p.title}</h2>
                <p className="mt-3 text-neutral-500">{p.summary}</p>
                <p className="mt-4 text-sm text-neutral-500">
                  {p.jurisdiction} · {p.status}
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
