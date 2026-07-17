"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeft } from "lucide-react";
import { MOBILE_NAV, navGroupsForRole } from "@/components/admin/admin-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/(admin)/admin/(console)/actions";

/** Sidebar width — keep in sync with sticky bottom bars (`md:left-52`). */
export const ADMIN_SIDEBAR_WIDTH_CLASS = "w-52";
export const ADMIN_SIDEBAR_OFFSET_CLASS = "md:left-52";

type AdminShellProps = {
  adminEmail: string;
  adminRole: string;
  children: React.ReactNode;
};

function NavLinks({
  onNavigate,
  groups
}: {
  onNavigate?: () => void;
  groups: ReturnType<typeof navGroupsForRole>;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            {group.label}
          </p>
          <div className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ adminEmail, adminRole, children }: AdminShellProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const initials = adminEmail.slice(0, 2).toUpperCase();
  const navGroups = navGroupsForRole(adminRole);
  const wideContent = pathname.startsWith("/admin/orders/");

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh">
        {!isMobile ? (
          <aside
            className={cn(
              "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex",
              ADMIN_SIDEBAR_WIDTH_CLASS
            )}
          >
            <div className="flex h-11 items-center border-b border-sidebar-border px-3">
              <Image
                src="/logo.png"
                alt="Cashmir Biotech"
                width={88}
                height={28}
                className="h-6 w-auto opacity-90"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
              <NavLinks groups={navGroups} />
            </div>
            <div className="border-t border-sidebar-border p-2.5">
              <div className="mb-2 flex items-center gap-2 px-1">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-muted text-[10px] font-medium text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium leading-tight">{adminEmail}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{adminRole}</p>
                </div>
              </div>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-xs">
                  <LogOut className="size-3.5" />
                  Sign out
                </Button>
              </form>
            </div>
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
            <div className="flex h-11 items-center justify-between gap-3 px-3 md:px-5">
              <div className="flex min-w-0 items-center gap-2">
                {isMobile ? (
                  <Sheet>
                    <SheetTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8" aria-label="Open navigation">
                          <Menu className="size-4" />
                        </Button>
                      }
                    />
                    <SheetContent side="left" className="w-64 p-0">
                      <SheetHeader className="border-b px-4 py-3 text-left">
                        <SheetTitle className="flex items-center gap-2 text-sm">
                          <PanelLeft className="size-3.5 text-muted-foreground" />
                          Console
                        </SheetTitle>
                      </SheetHeader>
                      <div className="px-2 py-3">
                        <NavLinks groups={navGroups} />
                      </div>
                      <Separator />
                      <div className="p-3">
                        <p className="mb-2 truncate text-[11px] text-muted-foreground">{adminEmail}</p>
                        <form action={signOutAction}>
                          <Button type="submit" variant="outline" size="sm" className="w-full justify-start gap-2">
                            <LogOut className="size-3.5" />
                            Sign out
                          </Button>
                        </form>
                      </div>
                    </SheetContent>
                  </Sheet>
                ) : null}
                {isMobile ? (
                  <Image src="/logo.png" alt="Cashmir Biotech" width={80} height={26} className="h-5 w-auto" />
                ) : (
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground">Ops</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  target="_blank"
                  className="hidden text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:inline"
                >
                  Storefront →
                </Link>
                {isMobile ? (
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-muted text-[10px] font-medium">{initials}</AvatarFallback>
                  </Avatar>
                ) : null}
              </div>
            </div>
          </header>

          <main className={cn("flex-1 px-3 py-4 md:px-6 md:py-5", isMobile ? "pb-24" : "")}>
            <div className={cn("mx-auto w-full", wideContent ? "max-w-7xl" : "max-w-6xl")}>{children}</div>
          </main>

          {isMobile ? (
            <nav
              className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              aria-label="Main navigation"
            >
              <div className="mx-auto grid max-w-lg grid-cols-5">
                {MOBILE_NAV.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg",
                          active ? "bg-muted" : "bg-transparent"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="truncate">{item.shortLabel ?? item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
