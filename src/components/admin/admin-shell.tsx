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
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
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
        {/* Desktop sidebar */}
        {!isMobile ? (
          <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
            <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
              <Image src="/logo.png" alt="Cashmir Biotech" width={120} height={40} className="h-9 w-auto" />
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks groups={navGroups} />
            </div>
            <div className="border-t border-sidebar-border p-4">
              <div className="mb-3 flex items-center gap-3 px-1">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{adminEmail}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{adminRole}</p>
                </div>
              </div>
              <form action={signOutAction}>
                <Button type="submit" variant="outline" className="w-full justify-start gap-2">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
            <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                {isMobile ? (
                  <Sheet>
                    <SheetTrigger
                      render={
                        <Button variant="outline" size="icon" aria-label="Open navigation">
                          <Menu className="size-4" />
                        </Button>
                      }
                    />
                    <SheetContent side="left" className="w-72 p-0">
                      <SheetHeader className="border-b px-5 py-4 text-left">
                        <SheetTitle className="flex items-center gap-2">
                          <PanelLeft className="size-4 text-primary" />
                          Console
                        </SheetTitle>
                      </SheetHeader>
                      <div className="px-3 py-4">
                        <NavLinks groups={navGroups} />
                      </div>
                      <Separator />
                      <div className="p-4">
                        <p className="mb-3 truncate text-xs text-muted-foreground">{adminEmail}</p>
                        <form action={signOutAction}>
                          <Button type="submit" variant="outline" className="w-full justify-start gap-2">
                            <LogOut className="size-4" />
                            Sign out
                          </Button>
                        </form>
                      </div>
                    </SheetContent>
                  </Sheet>
                ) : null}
                {isMobile ? (
                  <Image src="/logo.png" alt="Cashmir Biotech" width={100} height={32} className="h-8 w-auto" />
                ) : (
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Operations Console
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  target="_blank"
                  className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline"
                >
                  View site →
                </Link>
                {isMobile ? (
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                ) : null}
              </div>
            </div>
          </header>

          <main className={cn("flex-1 px-4 py-6 md:px-8 md:py-8", isMobile ? "pb-24" : "")}>
            <div className={cn("mx-auto w-full", wideContent ? "max-w-7xl" : "max-w-6xl")}>{children}</div>
          </main>

          {/* Mobile bottom nav */}
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
                        "flex min-w-0 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-xl",
                          active ? "bg-primary/10" : "bg-transparent"
                        )}
                      >
                        <Icon className="size-4" />
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
