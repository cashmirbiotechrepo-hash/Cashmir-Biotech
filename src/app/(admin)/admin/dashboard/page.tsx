import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authCookieName, getCurrentAdmin, requireAdminSession } from "@/lib/auth";
import {
  getDashboardContent,
  upsertHomepageContent,
  updatePatentContent,
  updateProductContent,
  updateTeamMemberContent
} from "@/modules/cms/services/content.service";
import {
  homepageSettingsSchema,
  patentUpdateSchema,
  productUpdateSchema,
  teamMemberUpdateSchema
} from "@/modules/cms/validations/admin";
import { logger } from "@/lib/logger";

export const metadata = {
  title: "Admin Dashboard · Cashmir Biotech",
  robots: { index: false, follow: false }
};

type DashboardProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  const params = searchParams ? await searchParams : {};
  const activeTab = typeof params.tab === "string" ? params.tab : "overview";
  const savedState = typeof params.saved === "string" ? params.saved : "";
  const errParam = params.error;
  const validationError = (Array.isArray(errParam) ? errParam[0] : errParam) === "validation";

  const { settings, products, patents, team } = await getDashboardContent();

  async function logout() {
    "use server";
    await requireAdminSession();
    (await cookies()).delete(authCookieName);
    redirect("/admin/login");
  }

  async function updateSettings(formData: FormData) {
    "use server";
    await requireAdminSession();
    const parsed = homepageSettingsSchema.safeParse({
      heroTitle: formData.get("heroTitle"),
      heroSubtitle: formData.get("heroSubtitle"),
      heroDescription: formData.get("heroDescription"),
      ctaPrimaryText: formData.get("ctaPrimaryText"),
      ctaPrimaryHref: formData.get("ctaPrimaryHref"),
      ctaSecondaryText: formData.get("ctaSecondaryText"),
      ctaSecondaryHref: formData.get("ctaSecondaryHref"),
      missionStatement: formData.get("missionStatement")
    });
    if (!parsed.success) {
      logger.warn({ tab: "settings", issues: parsed.error.flatten() }, "admin homepage validation failed");
      redirect("/admin/dashboard?tab=settings&error=validation");
    }
    await upsertHomepageContent(parsed.data);
    redirect("/admin/dashboard?tab=settings&saved=settings");
  }

  async function saveProduct(formData: FormData) {
    "use server";
    await requireAdminSession();
    const parsed = productUpdateSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      shortBenefit: formData.get("shortBenefit"),
      description: formData.get("description"),
      mrpInr: formData.get("mrpInr"),
      sizeLabel: formData.get("sizeLabel"),
      imageUrl: formData.get("imageUrl")
    });
    if (!parsed.success) {
      logger.warn({ tab: "products", issues: parsed.error.flatten() }, "admin product validation failed");
      redirect("/admin/dashboard?tab=products&error=validation");
    }
    const { id, ...data } = parsed.data;
    await updateProductContent(id, data);
    redirect("/admin/dashboard?tab=products&saved=products");
  }

  async function savePatent(formData: FormData) {
    "use server";
    await requireAdminSession();
    const parsed = patentUpdateSchema.safeParse({
      id: formData.get("id"),
      title: formData.get("title"),
      summary: formData.get("summary"),
      status: formData.get("status")
    });
    if (!parsed.success) {
      logger.warn({ tab: "patents", issues: parsed.error.flatten() }, "admin patent validation failed");
      redirect("/admin/dashboard?tab=patents&error=validation");
    }
    const { id, ...data } = parsed.data;
    await updatePatentContent(id, data);
    redirect("/admin/dashboard?tab=patents&saved=patents");
  }

  async function saveTeamMember(formData: FormData) {
    "use server";
    await requireAdminSession();
    const parsed = teamMemberUpdateSchema.safeParse({
      id: formData.get("id"),
      fullName: formData.get("fullName"),
      role: formData.get("role"),
      bio: formData.get("bio"),
      avatarUrl: formData.get("avatarUrl")
    });
    if (!parsed.success) {
      logger.warn({ tab: "team", issues: parsed.error.flatten() }, "admin team validation failed");
      redirect("/admin/dashboard?tab=team&error=validation");
    }
    const { id, ...data } = parsed.data;
    await updateTeamMemberContent(id, data);
    redirect("/admin/dashboard?tab=team&saved=team");
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: "◻" },
    { key: "settings", label: "Homepage", icon: "⚙" },
    { key: "products", label: "Products", icon: "◆" },
    { key: "patents", label: "Patents", icon: "◇" },
    { key: "team", label: "Board", icon: "●" }
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* ─── Sidebar + Content Layout ─── */}
      <div className="flex min-h-screen">
        {/* ─── Sidebar ─── */}
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-[rgb(var(--outline-variant))]/20 bg-surface-container-low lg:flex">
          {/* Brand */}
          <div className="flex h-[72px] items-center gap-3 border-b border-[rgb(var(--outline-variant))]/20 px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-brand">
              <span className="text-sm font-bold text-on-primary-container">CB</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-on-surface [font-family:var(--font-headline)]">
                Cashmir Biotech
              </p>
              <p className="text-[10px] tracking-wider text-on-surface/40 uppercase">Admin Console</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.15em] text-on-surface/35">
              Management
            </p>
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/admin/dashboard?tab=${t.key}`}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  activeTab === t.key
                    ? "bg-primary-brand text-on-primary-container shadow-sm"
                    : "text-on-surface/55 hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className={`text-xs ${activeTab === t.key ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`}>
                  {t.icon}
                </span>
                {t.label}
              </Link>
            ))}
          </nav>

          {/* Bottom */}
          <div className="border-t border-[rgb(var(--outline-variant))]/20 p-4">
            <form action={logout}>
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface/50 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500">
                <span className="text-xs">↩</span>
                Sign Out
              </button>
            </form>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main className="flex-1 overflow-y-auto">
          {/* Top Bar */}
          <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[rgb(var(--outline-variant))]/20 bg-surface/80 px-6 backdrop-blur-xl lg:px-10">
            {/* Mobile Nav */}
            <div className="flex items-center gap-2 overflow-x-auto lg:hidden">
              {tabs.map((t) => (
                <Link
                  key={t.key}
                  href={`/admin/dashboard?tab=${t.key}`}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    activeTab === t.key
                      ? "bg-primary-brand text-on-primary-container"
                      : "text-on-surface/50 hover:bg-surface-container"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>

            <div className="hidden lg:block">
              <h1 className="text-xl font-semibold tracking-tight text-on-surface [font-family:var(--font-headline)]">
                {tabs.find((t) => t.key === activeTab)?.label ?? "Dashboard"}
              </h1>
              <p className="text-xs text-on-surface/40">Manage your website content</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full bg-surface-container px-3 py-1.5 sm:flex">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-on-surface/60">System Online</span>
              </div>
              <form action={logout} className="lg:hidden">
                <button className="rounded-lg border border-[rgb(var(--outline-variant))]/20 px-3 py-1.5 text-xs font-medium text-on-surface/60 transition hover:bg-surface-container">
                  Sign Out
                </button>
              </form>
            </div>
          </header>

          {/* Content Area */}
          <div className="p-6 lg:p-10">
            {/* Success Toast */}
            {validationError ? (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/5 px-5 py-3.5">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Please check your input — some fields are invalid or too long.
                </p>
              </div>
            ) : null}
            {savedState ? (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <span className="text-xs text-emerald-600">✓</span>
                </div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Changes saved successfully
                </p>
              </div>
            ) : null}

            {/* ─── Overview Tab ─── */}
            {activeTab === "overview" ? (
              <div className="space-y-8">
                {/* Welcome Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-primary-brand p-8">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
                  <p className="relative text-xs font-medium uppercase tracking-[0.2em] text-on-primary-container/50">
                    Welcome back
                  </p>
                  <h2 className="relative mt-2 text-2xl font-bold text-on-primary-container [font-family:var(--font-headline)] sm:text-3xl">
                    Admin Dashboard
                  </h2>
                  <p className="relative mt-1 text-sm text-on-primary-container/60">
                    Here&apos;s what&apos;s happening with your website today.
                  </p>
                </div>

                {/* Stat Cards */}
                <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <StatCard label="Products" value={products.length} icon="◆" accent="bg-blue-500" />
                  <StatCard label="Patents" value={patents.length} icon="◇" accent="bg-violet-500" />
                  <StatCard label="Board Members" value={team.length} icon="●" accent="bg-emerald-500" />
                </section>

                {/* Quick Access */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold text-on-surface/40 uppercase tracking-wider">
                    Quick Actions
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {tabs.filter(t => t.key !== "overview").map((t) => (
                      <Link
                        key={t.key}
                        href={`/admin/dashboard?tab=${t.key}`}
                        className="group flex items-center gap-4 rounded-xl border border-[rgb(var(--outline-variant))]/15 bg-surface-container-low p-5 transition-all duration-300 hover:border-[rgb(var(--outline-variant))]/40 hover:shadow-lg hover:shadow-black/[0.03]"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-sm transition-transform duration-300 group-hover:scale-110">
                          {t.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-on-surface/90">{t.label}</p>
                          <p className="text-xs text-on-surface/40">Manage →</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            {/* ─── Settings Tab ─── */}
            {activeTab === "settings" ? (
              <section className="mx-auto max-w-2xl">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-on-surface [font-family:var(--font-headline)]">Homepage Content</h2>
                  <p className="mt-1 text-sm text-on-surface/40">Update your website&apos;s hero section and mission statement.</p>
                </div>
                <form action={updateSettings} className="space-y-5">
                  <FormField label="Hero Title">
                    <input
                      name="heroTitle"
                      defaultValue={settings?.heroTitle ?? ""}
                      className="admin-input"
                      placeholder="Enter hero title..."
                    />
                  </FormField>
                  <FormField label="Hero Subtitle (eyebrow text)">
                    <input
                      name="heroSubtitle"
                      defaultValue={settings?.heroSubtitle ?? ""}
                      className="admin-input"
                      placeholder="Enter hero subtitle..."
                    />
                  </FormField>
                  <FormField label="Hero Description">
                    <textarea
                      name="heroDescription"
                      defaultValue={settings?.heroDescription ?? ""}
                      className="admin-input min-h-[100px] resize-y"
                      placeholder="Enter hero description..."
                    />
                  </FormField>
                  <FormField label="Mission Statement">
                    <textarea
                      name="missionStatement"
                      defaultValue={settings?.missionStatement ?? ""}
                      className="admin-input min-h-[100px] resize-y"
                      placeholder="Enter mission statement..."
                    />
                  </FormField>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Primary CTA Text">
                      <input name="ctaPrimaryText" defaultValue={settings?.ctaPrimaryText ?? "Explore Catalog"} className="admin-input" />
                    </FormField>
                    <FormField label="Primary CTA Link">
                      <input name="ctaPrimaryHref" defaultValue={settings?.ctaPrimaryHref ?? "/products"} className="admin-input" />
                    </FormField>
                    <FormField label="Secondary CTA Text">
                      <input name="ctaSecondaryText" defaultValue={settings?.ctaSecondaryText ?? "View Patents"} className="admin-input" />
                    </FormField>
                    <FormField label="Secondary CTA Link">
                      <input name="ctaSecondaryHref" defaultValue={settings?.ctaSecondaryHref ?? "/patents"} className="admin-input" />
                    </FormField>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button className="admin-btn-primary">
                      Save Changes
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {/* ─── Products Tab ─── */}
            {activeTab === "products" ? (
              <section>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-on-surface [font-family:var(--font-headline)]">Products</h2>
                  <p className="mt-1 text-sm text-on-surface/40">Edit product details including pricing and descriptions.</p>
                </div>
                <div className="space-y-5">
                  {products.map((p, index) => (
                    <form
                      key={p.id}
                      action={saveProduct}
                      className="group rounded-2xl border border-[rgb(var(--outline-variant))]/15 bg-surface-container-low p-6 transition-all duration-300 hover:border-[rgb(var(--outline-variant))]/30 hover:shadow-lg hover:shadow-black/[0.03]"
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-xs font-bold text-on-surface/40">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-sm font-semibold text-on-surface/70">{p.name || "Untitled Product"}</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField label="Product Name">
                          <input name="name" defaultValue={p.name} className="admin-input" />
                        </FormField>
                        <FormField label="Short Benefit">
                          <input name="shortBenefit" defaultValue={p.shortBenefit} className="admin-input" />
                        </FormField>
                        <FormField label="Size Label">
                          <input name="sizeLabel" defaultValue={p.sizeLabel} className="admin-input" />
                        </FormField>
                        <FormField label="Price (INR)">
                          <input name="mrpInr" type="number" min={0} step={1} required defaultValue={p.mrpInr} className="admin-input" />
                        </FormField>
                        <FormField label="Image URL" className="md:col-span-2">
                          <input name="imageUrl" defaultValue={p.imageUrl} className="admin-input" />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                          <textarea name="description" defaultValue={p.description} className="admin-input min-h-[80px] resize-y" />
                        </FormField>
                      </div>
                      <div className="mt-5 flex justify-end">
                        <button className="admin-btn-primary">Save Product</button>
                      </div>
                    </form>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ─── Patents Tab ─── */}
            {activeTab === "patents" ? (
              <section>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-on-surface [font-family:var(--font-headline)]">Patents</h2>
                  <p className="mt-1 text-sm text-on-surface/40">Update patent details and publication status.</p>
                </div>
                <div className="space-y-5">
                  {patents.map((p, index) => (
                    <form
                      key={p.id}
                      action={savePatent}
                      className="group rounded-2xl border border-[rgb(var(--outline-variant))]/15 bg-surface-container-low p-6 transition-all duration-300 hover:border-[rgb(var(--outline-variant))]/30 hover:shadow-lg hover:shadow-black/[0.03]"
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-xs font-bold text-on-surface/40">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-sm font-semibold text-on-surface/70">{p.title || "Untitled Patent"}</h3>
                      </div>
                      <div className="grid gap-4">
                        <FormField label="Patent Title">
                          <input name="title" defaultValue={p.title} className="admin-input" />
                        </FormField>
                        <FormField label="Status">
                          <input name="status" defaultValue={p.status} className="admin-input" />
                        </FormField>
                        <FormField label="Summary">
                          <textarea name="summary" defaultValue={p.summary} className="admin-input min-h-[80px] resize-y" />
                        </FormField>
                      </div>
                      <div className="mt-5 flex justify-end">
                        <button className="admin-btn-primary">Save Patent</button>
                      </div>
                    </form>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ─── Team Tab ─── */}
            {activeTab === "team" ? (
              <section>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-on-surface [font-family:var(--font-headline)]">Board Members</h2>
                  <p className="mt-1 text-sm text-on-surface/40">Update team member profiles and biographies.</p>
                </div>
                <div className="space-y-5">
                  {team.map((m, index) => (
                    <form
                      key={m.id}
                      action={saveTeamMember}
                      className="group rounded-2xl border border-[rgb(var(--outline-variant))]/15 bg-surface-container-low p-6 transition-all duration-300 hover:border-[rgb(var(--outline-variant))]/30 hover:shadow-lg hover:shadow-black/[0.03]"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-brand text-xs font-bold text-on-primary-container">
                          {m.fullName?.[0]?.toUpperCase() ?? String(index + 1)}
                        </span>
                        <h3 className="text-sm font-semibold text-on-surface/70">{m.fullName || "Unnamed Member"}</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField label="Full Name">
                          <input name="fullName" defaultValue={m.fullName} className="admin-input" />
                        </FormField>
                        <FormField label="Role / Title">
                          <input name="role" defaultValue={m.role} className="admin-input" />
                        </FormField>
                        <FormField label="Avatar URL" className="md:col-span-2">
                          <input name="avatarUrl" defaultValue={m.avatarUrl} className="admin-input" />
                        </FormField>
                        <FormField label="Biography" className="md:col-span-2">
                          <textarea name="bio" defaultValue={m.bio} className="admin-input min-h-[80px] resize-y" />
                        </FormField>
                      </div>
                      <div className="mt-5 flex justify-end">
                        <button className="admin-btn-primary">Save Member</button>
                      </div>
                    </form>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Stat Card Component ─────────────────────────────────────── */
function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent: string }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[rgb(var(--outline-variant))]/15 bg-surface-container-low p-6 transition-all duration-300 hover:border-[rgb(var(--outline-variant))]/30 hover:shadow-xl hover:shadow-black/[0.04]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-on-surface/40">{label}</p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-on-surface [font-family:var(--font-headline)]">
            {value}
          </p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}/10 text-sm transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </span>
      </div>
      <div className="mt-4 h-1 w-12 rounded-full bg-surface-container transition-all duration-300 group-hover:w-20">
        <div className={`h-full rounded-full ${accent} w-full`} />
      </div>
    </article>
  );
}

/* ── Form Field Wrapper ──────────────────────────────────────── */
function FormField({
  label,
  children,
  className = ""
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-on-surface/40">
        {label}
      </label>
      {children}
    </div>
  );
}
