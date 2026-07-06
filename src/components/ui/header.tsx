"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FlaskConical,
  ChevronDown,
  ShoppingCart,
  LayoutGrid,
  Microscope,
  Users,
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import { useScrollPinned } from "@/components/ui/use-scroll";

type NavItem =
  | { label: string; href: string; icon?: React.ReactNode }
  | {
      label: string;
      icon?: React.ReactNode;
      children: { label: string; href: string; description?: string }[];
    };

const NAV_ITEMS: NavItem[] = [
  { label: "Catalog", href: "/products", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { label: "Patents", href: "/patents", icon: <Microscope className="h-3.5 w-3.5" /> },
  { label: "Board", href: "/team", icon: <Users className="h-3.5 w-3.5" /> },
  {
    label: "Resources",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    children: [
      { label: "Research registry", href: "/patents", description: "Patents & filings" },
      { label: "Product catalog", href: "/products", description: "Formulations & SKUs" },
      { label: "Leadership", href: "/team", description: "Board & advisors" },
      { label: "Contact", href: "#contact", description: "Partnerships & press" }
    ]
  }
];

export function Header() {
  const pathname = usePathname();
  const scrolled = useScrollPinned(36, 14);
  const [open, setOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const reducedMotionPref = useReducedMotion();
  const [motionReady, setMotionReady] = React.useState(false);

  React.useEffect(() => setMotionReady(true), []);
  const reduceMotion = motionReady ? Boolean(reducedMotionPref) : false;

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  React.useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "pointer-events-none mx-auto max-w-7xl px-4 transition-[padding] duration-300 ease-out sm:px-6 lg:px-8",
          scrolled ? "pt-3 pb-2 md:pt-4 md:pb-3" : "pt-4 pb-0 md:pt-6"
        )}
      >
        <nav
          className={cn(
            "pointer-events-auto relative flex min-h-[52px] w-full items-center justify-between gap-3 border backdrop-blur-xl transition-[border-radius,background-color,box-shadow,border-color] duration-300 ease-out md:min-h-[56px] md:gap-4",
            scrolled
              ? "rounded-2xl border-primary/25 bg-surface/93 px-3 py-2 shadow-[0_22px_56px_rgba(0,0,0,0.52),0_0_0_1px_rgba(234,179,8,0.08)_inset] md:px-5"
              : "rounded-none border-transparent bg-[rgba(13,13,13,0.48)] px-3 py-2 shadow-none md:px-4"
          )}
        >
          {/* Brand */}
          <Link
            href="/"
            className="group flex min-w-0 shrink-0 items-center gap-2.5 md:gap-3"
            onClick={() => setOpen(false)}
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/35 bg-gradient-to-br from-primary/15 to-primary/5 shadow-[0_0_24px_rgba(234,179,8,0.12)] transition-all duration-300 group-hover:border-primary/55 group-hover:shadow-[0_0_28px_rgba(234,179,8,0.2)] md:h-10 md:w-10">
              <FlaskConical className="h-[18px] w-[18px] text-primary md:h-5 md:w-5" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">
                Cashmir
              </span>
              <span className="mt-0.5 text-base font-bold tracking-tight text-heading [font-family:var(--font-headline)] md:text-lg">
                Biotech
              </span>
            </div>
          </Link>

          {/* Center nav — desktop (true center between logo & CTAs) */}
          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-full border border-outline-variant/15 bg-surface-container-low/50 px-1 py-1 shadow-inner shadow-black/20 backdrop-blur-sm">
              {NAV_ITEMS.map((item) =>
                "href" in item ? (
                  <DesktopNavLink key={item.href} href={item.href} pathname={pathname} icon={item.icon}>
                    {item.label}
                  </DesktopNavLink>
                ) : (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setDropdownOpen(true)}
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                        dropdownOpen ? "bg-primary/15 text-primary" : "text-on-muted hover:bg-surface-container-high/80 hover:text-heading"
                      )}
                      aria-expanded={dropdownOpen}
                      aria-haspopup="true"
                    >
                      {item.icon}
                      {item.label}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 opacity-70 transition-transform duration-300",
                          dropdownOpen && "rotate-180"
                        )}
                      />
                    </button>
                    <AnimatePresence>
                      {dropdownOpen && (
                        <motion.div
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute left-1/2 top-full z-50 mt-3 w-[min(100vw-2rem,280px)] -translate-x-1/2"
                        >
                          <div className="rounded-xl border border-primary/20 bg-surface/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
                            {item.children.map((sub) => (
                              <Link
                                key={sub.href + sub.label}
                                href={sub.href}
                                className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
                              >
                                <span className="flex items-center justify-between gap-2 text-sm font-medium text-heading">
                                  {sub.label}
                                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                                </span>
                                {sub.description ? (
                                  <span className="text-[11px] text-on-muted">{sub.description}</span>
                                ) : null}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center justify-end gap-2 md:gap-2.5">
            <Link
              href="/admin/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "hidden h-9 border-primary/25 bg-transparent text-[11px] font-semibold uppercase tracking-[0.12em] text-heading hover:border-primary/40 hover:bg-primary/10 hover:text-primary md:inline-flex"
              )}
            >
              Admin
            </Link>
            <Button
              size="sm"
              className="hidden h-9 gap-2 bg-primary-brand px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-on-primary-container shadow-[0_8px_28px_rgba(234,179,8,0.22)] transition hover:brightness-110 md:inline-flex"
              asChild
            >
              <Link href="/products">
                <ShoppingCart className="h-4 w-4" />
                <span>Inquire</span>
              </Link>
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 text-on-muted hover:bg-surface-container-high/60 hover:text-heading md:hidden"
              asChild
            >
              <Link href="/products" aria-label="Catalog">
                <ShoppingCart className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10 border-primary/20 bg-surface-container-low/50 hover:bg-surface-container-high md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              <MenuToggleIcon open={open} className="size-5 text-heading" duration={280} />
            </Button>
          </div>
        </nav>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] md:hidden"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              initial={reduceMotion ? false : { x: "100%" }}
              animate={{ x: 0 }}
              exit={reduceMotion ? undefined : { x: "100%" }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", damping: 30, stiffness: 320, mass: 0.85 }
              }
              className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(100%,400px)] flex-col border-l border-primary/20 bg-surface shadow-[-24px_0_48px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/25 px-5 py-4">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Navigate</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-on-muted hover:bg-surface-container-high hover:text-heading"
                  aria-label="Close"
                >
                  <MenuToggleIcon open className="size-5" duration={200} />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
                {NAV_ITEMS.map((item, idx) =>
                  "href" in item ? (
                    <motion.div
                      key={item.href}
                      initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reduceMotion ? 0 : idx * 0.05 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors",
                          pathname === item.href || pathname.startsWith(item.href + "/")
                            ? "bg-primary/15 text-primary"
                            : "text-heading hover:bg-surface-container-high"
                        )}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-low text-primary">
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    </motion.div>
                  ) : (
                    <div key={item.label} className="py-2">
                      <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-on-muted">
                        {item.label}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {item.children.map((sub, j) => (
                          <motion.div
                            key={sub.href + sub.label}
                            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: reduceMotion ? 0 : 0.08 + j * 0.04 }}
                          >
                            <Link
                              href={sub.href}
                              onClick={() => setOpen(false)}
                              className="flex flex-col rounded-xl px-4 py-3 text-heading hover:bg-surface-container-high"
                            >
                              <span className="font-medium">{sub.label}</span>
                              {sub.description ? (
                                <span className="mt-0.5 text-xs text-on-muted">{sub.description}</span>
                              ) : null}
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </nav>
              <div className="border-t border-outline-variant/25 p-4 space-y-3">
                <Link
                  href="/admin/login"
                  onClick={() => setOpen(false)}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full h-11 border-primary/30 font-semibold uppercase tracking-[0.1em] text-heading"
                  )}
                >
                  Admin login
                </Link>
                <Button className="h-11 w-full bg-primary-brand font-bold uppercase tracking-[0.12em] text-on-primary-container shadow-lg shadow-primary/20" asChild>
                  <Link href="/products" onClick={() => setOpen(false)}>
                    Inquire / Catalog
                  </Link>
                </Button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function DesktopNavLink({
  href,
  pathname,
  children,
  icon
}: {
  href: string;
  pathname: string | null;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const active = pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200",
        active ? "text-primary" : "text-on-muted hover:bg-surface-container-high/70 hover:text-heading"
      )}
    >
      {icon ? <span className={cn("opacity-70 transition-opacity", active && "text-primary opacity-100")}>{icon}</span> : null}
      <span className="relative">
        {children}
        <span
          className={cn(
            "absolute -bottom-1 left-0 right-0 mx-auto h-[2px] max-w-[75%] rounded-full bg-primary transition-[opacity,transform] duration-300 ease-out",
            active ? "opacity-100 scale-x-100" : "scale-x-0 opacity-0 group-hover:scale-x-75 group-hover:opacity-40"
          )}
          aria-hidden
        />
      </span>
    </Link>
  );
}

export const WordmarkIcon = (props: React.ComponentProps<"svg">) => (
  <svg viewBox="0 0 84 24" fill="currentColor" {...props}>
    <path d="M45.035 23.984c-1.34-.062-2.566-.441-3.777-1.16-1.938-1.152-3.465-3.187-4.02-5.36-.199-.784-.238-1.128-.234-2.058 0-.691.008-.87.062-1.207.23-1.5.852-2.883 1.852-4.144.297-.371 1.023-1.09 1.41-1.387 1.399-1.082 2.84-1.68 4.406-1.816.536-.047 1.528-.02 2.047.054 1.227.184 2.227.543 3.106 1.121 1.277.84 2.5 2.184 3.367 3.7.098.168.172.308.172.312-.004 0-1.047.723-2.32 1.598l-2.711 1.867c-.61.422-2.91 2.008-2.993 2.062l-.074.047-1-1.574c-.55-.867-1.008-1.594-1.012-1.61-.007-.019.922-.648 2.188-1.476 1.215-.793 2.2-1.453 2.191-1.46-.02-.032-.508-.27-.691-.34a5 5 0 0 0-.465-.13c-.371-.09-1.105-.125-1.426-.07-1.285.219-2.336 1.3-2.777 2.852-.215.761-.242 1.636-.074 2.355.129.527.383 1.102.691 1.543.234.332.727.82 1.047 1.031.664.434 1.195.586 1.969.555.613-.023 1.027-.129 1.64-.426 1.184-.574 2.16-1.554 2.828-2.843.122-.235.208-.372.227-.368.082.032 3.77 1.938 3.79 1.961.034.032-.407.93-.696 1.414a12 12 0 0 1-1.051 1.477c-.36.422-1.102 1.14-1.492 1.445a9.9 9.9 0 0 1-3.23 1.684 9.2 9.2 0 0 1-2.95.351M74.441 23.996c-1.488-.043-2.8-.363-4.066-.992-1.687-.848-2.992-2.14-3.793-3.774-.605-1.234-.863-2.402-.863-3.894.004-1.149.176-2.156.527-3.11.14-.378.531-1.171.75-1.515 1.078-1.703 2.758-2.934 4.805-3.524.847-.242 1.465-.332 2.433-.351 1.032-.024 1.743.055 2.48.277l.31.09.007 2.48c.004 1.364 0 2.481-.008 2.481a1 1 0 0 1-.12-.055c-.688-.347-2.09-.488-2.962-.296-.754.167-1.296.453-1.785.945a3.7 3.7 0 0 0-1.043 2.11c-.047.382-.02 1.109.055 1.437a3.4 3.4 0 0 0 .941 1.738c.75.75 1.715 1.102 2.875 1.05.645-.03 1.118-.14 1.563-.366q1.721-.864 2.02-3.145c.035-.293.042-1.266.042-7.957V0H84l-.012 8.434c-.008 7.851-.011 8.457-.054 8.757-.196 1.274-.586 2.25-1.301 3.243-1.293 1.808-3.555 3.07-6.145 3.437-.664.098-1.43.14-2.047.125M9.848 23.574a14 14 0 0 1-1.137-.152c-2.352-.426-4.555-1.781-6.117-3.774-.27-.335-.75-1.05-.95-1.406-1.156-2.047-1.695-4.27-1.64-6.77.047-1.995.43-3.66 1.23-5.316.524-1.086 1.04-1.87 1.793-2.715C4.567 1.72 6.652.535 8.793.171 9.68.02 10.093 0 12.297 0h1.789v5.441l-.961.016c-2.36.04-3.441.215-4.441.719-.836.414-1.278.879-1.895 1.976-.219.399-.535 1.02-.535 1.063 0 .02 1.285.027 3.918.027h3.914v5.113h-3.914c-2.54 0-3.918.008-3.918.028 0 .05.254.597.441.953.344.656.649 1.086 1.051 1.48.668.657 1.356.985 2.445 1.16.645.106 1.274.145 2.61.16l1.285.016v5.442l-2.055-.004a120 120 0 0 1-2.183-.016M16.469 14.715c0-5.504.011-9.04.031-9.29a5.54 5.54 0 0 1 1.527-3.48c.778-.82 1.922-1.457 3.118-1.734C21.915.035 22.422 0 24.39 0h1.652v4.914h-1.426c-1.324 0-1.445.004-1.644.055-.739.191-1.059.699-1.106 1.754l-.015.355h4.191v4.914h-4.184v11.602h-5.39ZM27.023 14.727c0-5.223.012-9.04.028-9.278.129-1.98 1.234-3.68 3.012-4.62.87-.462 1.777-.716 2.851-.802A61 61 0 0 1 34.945 0h1.649v4.914h-1.426c-1.32 0-1.441.004-1.64.055-.739.191-1.063.699-1.106 1.754l-.02.355h4.192v4.914H32.41v11.602h-5.387ZM55.48 15.406V7.22h4.66v1.363c0 1.3.005 1.363.051 1.363.04 0 .075-.054.133-.203.38-.98.969-1.68 1.711-2.031.563-.266 1.422-.43 2.492-.48l.414-.02v4.914l-.414.035c-.738.063-1.597.195-2.058.313-.297.082-.688.28-.875.449-.324.289-.532.703-.625 1.254-.094.547-.098.879-.098 5.144v4.274h-5.39Zm0 0" />
  </svg>
);
