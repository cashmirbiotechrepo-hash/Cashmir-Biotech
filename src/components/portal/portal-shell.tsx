"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Home, LifeBuoy, Package, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Overview", exact: true },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/documents", label: "Invoices" },
  { href: "/portal/organization", label: "Organisation" },
  { href: "/portal/circle", label: "Research Circle" },
  { href: "/portal/addresses", label: "Addresses" },
  { href: "/portal/security", label: "Security" },
  { href: "/portal/support", label: "Support" }
] as const;

const MOBILE = [
  { href: "/portal", label: "Home", icon: Home, exact: true },
  { href: "/portal/orders", label: "Orders", icon: Package },
  { href: "/portal/documents", label: "Invoices", icon: FileText },
  { href: "/portal/addresses", label: "Account", icon: UserRound },
  { href: "/portal/support", label: "Help", icon: LifeBuoy }
] as const;

function active(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function PortalShell({
  children,
  customerName,
  customerEmail
}: {
  children: React.ReactNode;
  customerName?: string | null;
  customerEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const firstName = (customerName ?? customerEmail.split("@")[0] ?? "there").split(" ")[0];
  const mark = initials(customerName?.trim() || firstName);
  const isHome = pathname === "/portal";

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-ivory text-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl gap-0 md:gap-10 md:px-8 md:py-10">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-ink/10 pr-6 md:flex lg:w-56">
          <Link href="/" className="mb-8 block">
            <p className="text-[13px] font-medium text-gold">Cashmir Biotech</p>
            <p className="mt-0.5 text-lg font-light tracking-tight">Portal</p>
          </Link>
          <nav className="flex flex-1 flex-col gap-0.5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  active(pathname, item.href, "exact" in item && item.exact)
                    ? "bg-ink text-paper"
                    : "text-ink-mute hover:bg-mist/80 hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 border-t border-ink/10 pt-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-[12px] font-medium text-paper">
                {mark}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{firstName}</p>
                <p className="truncate text-xs text-ink-mute">{customerEmail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-4 text-[13px] text-ink-mute underline-offset-4 hover:text-ink hover:underline"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-[4.75rem] md:pb-0">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/8 bg-ivory/90 px-4 py-3 backdrop-blur md:hidden">
            <Link href="/portal" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-medium text-paper">
                {mark}
              </span>
              {!isHome ? (
                <span className="text-[14px] font-medium text-ink">Cashmir</span>
              ) : (
                <span className="text-[14px] font-medium text-ink">Portal</span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="min-h-10 px-2 text-[13px] font-medium text-ink-mute hover:text-ink"
            >
              Sign out
            </button>
          </header>
          <main className="flex-1 px-4 py-5 md:px-0 md:py-0">{children}</main>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Primary"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE.map((item) => {
            const on = active(pathname, item.href, "exact" in item && item.exact);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex min-h-[3.35rem] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                    on ? "text-ink" : "text-ink-mute"
                  )}
                >
                  {on ? (
                    <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gold" aria-hidden />
                  ) : null}
                  <Icon className={cn("h-5 w-5", on ? "text-ink" : "text-ink-mute")} strokeWidth={on ? 2 : 1.5} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
