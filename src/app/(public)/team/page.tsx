import { Header2 } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { listTeamMembers } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import type { TeamMember } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Board Members · Cashmir Biotech" };

export default async function TeamPage() {
  let members: TeamMember[] = [];
  try {
    members = await listTeamMembers();
  } catch (error) {
    logger.error({ event: "team_fetch_failed", err: error }, "failed to load team members");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Header2 />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-brand">Leadership</p>
        <h1 className="mb-10 mt-2 text-4xl font-bold [font-family:var(--font-headline)]">Board Members</h1>
        {members.length === 0 ? (
          <p className="text-on-muted">Team profiles are being updated. Please check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {members.map((m) => (
              <article
                key={m.id}
                className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 transition-colors duration-300 hover:border-primary/30"
              >
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar URLs are admin-managed and may point to any host */}
                  <img
                    src={m.avatarUrl}
                    alt={m.fullName}
                    loading="lazy"
                    className="h-16 w-16 rounded-full border border-primary/20 object-cover"
                  />
                  <div>
                    <h2 className="text-xl font-semibold [font-family:var(--font-headline)]">{m.fullName}</h2>
                    <p className="text-sm text-primary-brand">{m.role}</p>
                  </div>
                </div>
                <p className="mt-4 leading-relaxed text-on-muted">{m.bio}</p>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
