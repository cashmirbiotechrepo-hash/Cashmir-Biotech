import Image from "next/image";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { listTeamMembers } from "@/modules/cms/services/content.service";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const members = await listTeamMembers();

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="mb-10 text-4xl font-bold">Board Members</h1>
        <div className="grid gap-6 md:grid-cols-2">
          {members.map((m) => (
            <article key={m.id} className="rounded-xl bg-surface-container-low p-5">
              <div className="flex items-center gap-4">
                <Image src={m.avatarUrl} alt={m.fullName} width={100} height={100} className="h-16 w-16 rounded-full object-cover" />
                <div>
                  <h2 className="text-xl font-semibold">{m.fullName}</h2>
                  <p className="text-sm text-primary-brand">{m.role}</p>
                </div>
              </div>
              <p className="mt-4 text-neutral-500">{m.bio}</p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
