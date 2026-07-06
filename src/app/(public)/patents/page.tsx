import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { listPatents } from "@/modules/cms/services/content.service";

export const dynamic = "force-dynamic";

export default async function PatentsPage() {
  const patents = await listPatents();

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="mb-10 text-4xl font-bold">Patents & Scientific Registry</h1>
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
      </main>
      <Footer />
    </div>
  );
}
