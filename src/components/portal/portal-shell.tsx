"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Overview", exact: true },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/organization", label: "Organisation" },
  { href: "/portal/circle", label: "Research Circle" },
  { href: "/portal/addresses", label: "Addresses" },
  { href: "/portal/security", label: "Security" },
  { href: "/portal/support", label: "Support" }
] as const;

const MOBILE = [
  { href: "/portal", label: "Home", exact: true },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/organization", label: "Org" },
  { href: "/portal/circle", label: "Circle" },
  { href: "/portal/support", label: "Help" }
] as const;

function active(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
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

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ivory via-paper to-pearl text-ink">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-0 md:gap-10 md:px-8 md:py-10">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-ink/10 pr-6 md:flex lg:w-56">
          <Link href="/" className="mb-10 block">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Cashmir Biotech</p>
            <p className="mt-1 text-lg font-light tracking-tight">Customer Portal</p>
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  active(pathname, item.href, "exact" in item && item.exact)
                    ? "bg-ink text-paper"
                    : "text-ink-mute hover:bg-mist/80 hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 border-t border-ink/10 pt-6">
            <p className="truncate text-sm text-ink">{firstName}</p>
            <p className="truncate text-xs text-ink-faint">{customerEmail}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
          <header className="flex items-center justify-between border-b border-ink/10 px-5 py-5 md:hidden">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Customer Portal</p>
              <p className="text-sm text-ink-mute">Hello {firstName}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
            >
              Sign out
            </button>
          </header>
          <main className="flex-1 px-5 py-8 md:px-0 md:py-0">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg justify-around gap-1 overflow-x-auto px-1 py-2">
          {MOBILE.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "block px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.1em]",
                  active(pathname, item.href, "exact" in item && item.exact) ? "text-ink" : "text-ink-faint"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
