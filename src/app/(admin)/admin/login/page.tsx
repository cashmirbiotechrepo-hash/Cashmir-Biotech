import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authCookieName, credentialsAreValid, signAdminSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

function safeReturnPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/admin/dashboard";
  return next;
}

type LoginPageProps = {
  searchParams?: Promise<{ next?: string; rateLimited?: string }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const sp = searchParams ? await searchParams : {};
  const returnTo = safeReturnPath(sp.next);
  const rateLimited = sp.rateLimited === "1" || sp.rateLimited === "true";

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const nextRaw = String(formData.get("next") ?? "/admin/dashboard");
    if (!credentialsAreValid(email, password)) {
      logger.warn({ event: "admin_login_rejected" }, "invalid admin credentials");
      return;
    }
    const token = await signAdminSession(email);
    (await cookies()).set(authCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });
    redirect(safeReturnPath(nextRaw));
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-6">
      {/* Ambient Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-200px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-surface-container blur-[120px]" />
        <div className="absolute -left-20 top-[40%] h-72 w-72 rounded-full bg-surface-container-high/40 blur-[100px]" />
        <div className="absolute -right-20 bottom-[15%] h-80 w-80 rounded-full bg-surface-container/50 blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgb(var(--on-background)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--on-background)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        {rateLimited ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-800 dark:text-amber-200">
            Too many sign-in attempts from this network. Please wait a minute, then try again.
          </div>
        ) : null}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-brand shadow-lg shadow-black/10">
            <span className="text-lg font-bold text-on-primary-container [font-family:var(--font-headline)]">CB</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface [font-family:var(--font-headline)]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-on-surface/40">
            Sign in to the Cashmir Biotech admin console
          </p>
        </div>

        {/* Login Card */}
        <form
          action={login}
          className="rounded-2xl border border-[rgb(var(--outline-variant))]/20 bg-surface-container-low p-8 shadow-2xl shadow-black/[0.06]"
        >
          <input type="hidden" name="next" value={returnTo} />
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-on-surface/40">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="admin@cashmirbiotech.com"
                className="admin-input"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-on-surface/40">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="admin-input"
              />
            </div>
          </div>

          <button className="admin-btn-primary mt-7 w-full">
            Sign In
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-on-surface/25">
          Cashmir Biotech © {new Date().getFullYear()} — Secure Admin Portal
        </p>
      </div>
    </main>
  );
}
