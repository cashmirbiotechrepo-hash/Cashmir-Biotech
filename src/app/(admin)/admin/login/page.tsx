import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { adminFont } from "@/lib/admin/fonts";
import { cn } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Operations Console · Cashmir Biotech",
  robots: { index: false, follow: false }
};

const CONSOLE_VERSION = "1.0.0";

const DOMAINS = ["Operations", "Manufacturing", "Research", "Commerce", "Administration"] as const;

/** Environment chip only on true localhost — never on Vercel staging/production. */
function showLocalDevChip(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV) return false;
  return true;
}

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; rateLimited?: string; expired?: string }>;
}) {
  const params = await searchParams;

  // Break the dashboard ↔ login?expired=1 loop: skip the auto-redirect when the
  // session was just expired. Cookies are cleared by the logout route the
  // keepalive calls before redirecting here (Server Components cannot modify cookies).
  if (params.expired !== "1") {
    const admin = await getCurrentAdmin();
    if (admin) redirect("/admin/dashboard");
  }

  const next = params.next?.startsWith("/admin") ? params.next : "/admin/dashboard";
  const localDev = showLocalDevChip();

  return (
    <main
      className={cn(
        adminFont.variable,
        "admin-scope font-admin relative flex h-svh max-h-svh flex-col overflow-hidden bg-background text-foreground lg:flex-row"
      )}
    >
      {/* Left — identity */}
      <aside className="relative hidden min-h-0 flex-1 flex-col justify-between overflow-hidden bg-zinc-950 px-10 py-9 text-zinc-100 lg:flex lg:max-w-[40%] lg:px-12 lg:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 18% 12%, rgb(184 148 88 / 0.14), transparent 52%), radial-gradient(ellipse at 88% 88%, rgb(255 255 255 / 0.04), transparent 40%)"
          }}
        />
        {/* Subtle molecular lattice — ~6% opacity */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.06]"
          viewBox="0 0 400 640"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="currentColor" strokeWidth="0.8">
            <circle cx="80" cy="120" r="18" />
            <circle cx="160" cy="90" r="10" />
            <circle cx="210" cy="160" r="14" />
            <circle cx="120" cy="220" r="8" />
            <circle cx="280" cy="200" r="12" />
            <circle cx="320" cy="120" r="7" />
            <path d="M80 120L160 90L210 160L120 220L80 120" />
            <path d="M210 160L280 200L320 120" />
            <circle cx="100" cy="420" r="16" />
            <circle cx="180" cy="380" r="9" />
            <circle cx="240" cy="460" r="13" />
            <circle cx="140" cy="500" r="7" />
            <path d="M100 420L180 380L240 460L140 500Z" />
            <path d="M40 300h320M200 40v560" strokeOpacity="0.35" />
          </g>
        </svg>

        <div className="relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.04em] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <span aria-hidden>←</span> Return to Cashmir Biotech
          </Link>

          <div className="mt-14">
            <Image
              src="/logo.png"
              alt="Cashmir Biotech"
              width={200}
              height={64}
              className="h-11 w-auto brightness-0 invert"
              priority
            />
            <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c4a46a]">
              Operations Console
            </p>
            <h1 className="mt-3 max-w-[14ch] text-[1.85rem] font-light leading-[1.15] tracking-tight text-white">
              Authorized personnel only.
            </h1>
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-zinc-400">
              Internal systems for research, manufacturing, commerce, intellectual property, and operational
              management.
            </p>
          </div>

          <ul className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-6">
            {DOMAINS.map((d) => (
              <li key={d} className="text-[12px] text-zinc-300">
                {d}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11px] text-zinc-500">Protected by encrypted authentication.</p>
      </aside>

      {/* Right — credentials */}
      <section className="relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <div className="relative mx-auto w-full max-w-[440px]">
          {/* Mobile brand strip */}
          <div className="mb-8 lg:hidden">
            <Link href="/" className="text-[11px] text-muted-foreground hover:text-foreground">
              ← Return to Cashmir Biotech
            </Link>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b89458]">
              Operations Console
            </p>
          </div>

          <LoginForm
            next={next}
            rateLimited={params.rateLimited === "1"}
            sessionExpired={params.expired === "1"}
          />

          <p className="mt-5 text-center text-[12px] text-muted-foreground">
            Restricted access for authorized Cashmir Biotech personnel.
          </p>

          <footer className="mt-6 flex items-center justify-center gap-3 border-t border-border pt-5 text-[11px] text-muted-foreground">
            <Link href="/contact" className="hover:text-foreground">
              Cashmir Biotech IT
            </Link>
            {localDev ? (
              <>
                <span className="text-zinc-300" aria-hidden>
                  ·
                </span>
                <span className="font-mono text-zinc-400">v{CONSOLE_VERSION}</span>
              </>
            ) : null}
          </footer>
        </div>
      </section>
    </main>
  );
}
