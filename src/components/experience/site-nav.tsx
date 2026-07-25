"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, X } from "lucide-react";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { useIntro } from "@/components/experience/intro-context";
import { useCart } from "@/components/shop/cart-context";
import { ThemeSegment, ThemeToggle } from "@/components/experience/theme-toggle";
import { cn } from "@/lib/utils";
import { SITE_CONTACT } from "@/lib/site-contact";

type NavLink = { label: string; href: string };

const LINKS: NavLink[] = [
  { label: "Shop", href: "/products" },
  { label: "Tools", href: "/tools" },
  { label: "Patents", href: "/patents" },
  { label: "Journal", href: "/blog" },
  { label: "Board", href: "/team" }
];

const CONTACT_HREF = `mailto:${SITE_CONTACT.primaryEmail}`;

function isActive(pathname: string, href: string) {
  return href !== "/" && pathname.startsWith(href);
}

/** Invisible 44px touch target — no bordered capsule. */
function IconHit({
  className,
  children,
  ...props
}: ComponentProps<"button"> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "relative grid h-11 w-11 place-items-center text-ink transition-opacity hover:opacity-80",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SiteNav({
  customer = null
}: {
  customer?: { name: string | null; email: string } | null;
}) {
  const { ready } = useIntro();
  const { count, ready: cartReady } = useCart();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const firstName = customer
    ? (customer.name ?? customer.email.split("@")[0] ?? "Account").split(" ")[0]
    : null;
  const accountHref = customer ? "/portal" : "/portal/login?next=/portal";
  const accountLabel = customer ? (firstName ? firstName : "Account") : "Sign in";
  const accountCursor = customer ? "Account" : "Sign in";
  const accountInitials = (() => {
    if (!customer) return null;
    const source = (customer.name ?? firstName ?? "A").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "A";
    if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
    return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
  })();

  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;

  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = () => {
      const current = window.scrollY;
      const nextCondensed = current > 40;
      const nextHidden = current > previous && current > 220 && !menuOpenRef.current;
      setCondensed((prev) => (prev === nextCondensed ? prev : nextCondensed));
      setHidden((prev) => (prev === nextHidden ? prev : nextHidden));
      previous = current;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [menuOpen]);

  const cartBadge =
    cartReady && count > 0 ? (
      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-mono text-[9px] font-semibold text-ink">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  return (
    <>
      {/* ── Mobile header: Logo · Cart · Menu only ───────────────────────── */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={
          ready
            ? {
                y: hidden || menuOpen ? -100 : 0,
                opacity: hidden || menuOpen ? 0 : 1
              }
            : { y: -100, opacity: 0 }
        }
        transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
        style={{ willChange: "transform, opacity" }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 md:hidden",
          menuOpen && "pointer-events-none"
        )}
      >
        <nav
          className="flex h-[calc(76px+env(safe-area-inset-top))] w-full items-center justify-between px-5 pt-[env(safe-area-inset-top)]"
          aria-label="Mobile"
        >
          <Link href="/" className="flex items-center" aria-label="Cashmir Biotech home">
            <Image
              src="/logo.png"
              alt="Cashmir Biotech"
              width={240}
              height={197}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex items-center gap-0.5">
            <Link
              href="/cart"
              data-cursor="Cart"
              aria-label={
                cartReady && count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"
              }
              className="relative grid h-11 w-11 place-items-center text-ink"
            >
              <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.6} />
              {cartBadge}
            </Link>
            <IconHit
              onClick={() => setMenuOpen(true)}
              aria-expanded={false}
              aria-controls="mobile-menu"
              aria-label="Open menu"
            >
              <span className="flex h-3.5 w-[18px] flex-col justify-between" aria-hidden>
                <span className="h-px w-full bg-ink" />
                <span className="h-px w-full bg-ink" />
                <span className="h-px w-full bg-ink" />
              </span>
            </IconHit>
          </div>
        </nav>
      </motion.header>

      {/* ── Desktop header (unchanged capsule language) ──────────────────── */}
      <motion.header
        initial={{ y: -140, opacity: 0 }}
        animate={
          ready
            ? { y: hidden ? -140 : 0, opacity: hidden ? 0 : 1 }
            : { y: -140, opacity: 0 }
        }
        transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
        style={{ willChange: "transform, opacity" }}
        className="fixed inset-x-0 top-0 z-50 hidden justify-center px-4 pt-4 md:flex"
      >
        <nav
          className={cn(
            "flex w-full max-w-frame items-center justify-between rounded-full px-7 transition-[padding,background-color,box-shadow,backdrop-filter] duration-500 ease-expo",
            condensed ? "glass-strong py-2.5 shadow-premium" : "py-4"
          )}
        >
          <Link href="/" className="flex items-center" aria-label="Cashmir Biotech home">
            <span className="logo-plate">
              <Image
                src="/logo.png"
                alt="Cashmir Biotech"
                width={240}
                height={197}
                priority
                className={cn(
                  "w-auto transition-all duration-500 ease-expo",
                  condensed ? "h-9" : "h-11"
                )}
              />
            </span>
          </Link>

          <ul className="flex items-center gap-9">
            {LINKS.map((link, i) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <motion.span
                    initial={{ opacity: 0, y: -6 }}
                    animate={ready ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.15 + i * 0.06, ease: EASE_OUT_EXPO }}
                  >
                    <Link
                      href={link.href}
                      data-cursor="View"
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:text-ink",
                        active ? "text-ink" : "text-ink-mute"
                      )}
                    >
                      {link.label}
                      <span
                        className={cn(
                          "absolute -bottom-1.5 left-0 h-px bg-gold transition-all duration-400 ease-expo",
                          active ? "w-full" : "w-0 group-hover:w-full"
                        )}
                      />
                    </Link>
                  </motion.span>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-3.5">
            <ThemeToggle />
            <Link
              href={accountHref}
              data-cursor={accountCursor}
              aria-label={customer ? "Account" : "Sign in"}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute transition-colors hover:text-ink"
            >
              {accountInitials ? (
                <span
                  className="grid h-8 w-8 place-items-center rounded-full border border-ink/15 bg-ink text-[10px] font-medium tracking-normal text-paper"
                  aria-hidden
                >
                  {accountInitials}
                </span>
              ) : null}
              <span>{accountLabel}</span>
            </Link>
            <Link
              href="/cart"
              data-cursor="Cart"
              aria-label={
                cartReady && count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"
              }
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:border-ink"
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={1.6} />
              {cartReady && count > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-mono text-[9px] font-semibold text-ink">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
            <Link
              href={CONTACT_HREF}
              data-cursor="Email"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-ink/15 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink transition-colors hover:border-ink"
            >
              <span className="relative z-10 transition-colors duration-500 group-hover:text-paper">
                Contact
              </span>
              <span className="absolute inset-0 origin-left scale-x-0 rounded-full bg-ink transition-transform duration-500 ease-expo group-hover:scale-x-100" />
            </Link>
          </div>
        </nav>
      </motion.header>

      {/* ── Mobile drawer (full recomposition) ───────────────────────────── */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            className="fixed inset-0 z-[60] flex flex-col bg-paper md:hidden"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)"
            }}
          >
            <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-ink/10 px-5">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center"
                aria-label="Cashmir Biotech home"
              >
                <Image
                  src="/logo.png"
                  alt="Cashmir Biotech"
                  width={240}
                  height={197}
                  className="h-10 w-auto"
                />
              </Link>
              <IconHit onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X className="h-[22px] w-[22px]" strokeWidth={1.5} />
              </IconHit>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8 pt-2">
              <nav aria-label="Primary">
                <ul className="flex flex-col">
                  {LINKS.map((link, i) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <motion.li
                        key={link.href}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.4,
                          delay: 0.04 + i * 0.04,
                          ease: EASE_OUT_EXPO
                        }}
                        className="border-b border-ink/10"
                      >
                        <Link
                          href={link.href}
                          className={cn(
                            "flex min-h-[76px] items-center justify-between gap-4 py-4 text-[clamp(1.875rem,8vw,2.35rem)] font-light leading-none tracking-tight",
                            active ? "text-ink" : "text-ink"
                          )}
                        >
                          {link.label}
                          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>
              </nav>

              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.28, ease: EASE_OUT_EXPO }}
                className="mt-8"
                aria-labelledby="mobile-prefs-label"
              >
                <h2
                  id="mobile-prefs-label"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
                >
                  Preferences
                </h2>
                <div className="mt-4">
                  <ThemeSegment />
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.34, ease: EASE_OUT_EXPO }}
                className="mt-8 border-t border-ink/10 pt-8"
                aria-labelledby="mobile-account-label"
              >
                <h2
                  id="mobile-account-label"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
                >
                  Account
                </h2>
                <Link
                  href="/cart"
                  className="mt-3 flex min-h-12 items-center justify-between text-[15px] text-ink"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <ShoppingBag className="h-4 w-4 text-ink-mute" strokeWidth={1.6} />
                    Cart
                  </span>
                  <span className="font-mono text-[12px] text-ink-mute">
                    {cartReady && count > 0 ? count : "—"}
                  </span>
                </Link>
                <Link
                  href={accountHref}
                  className="mt-4 flex min-h-12 w-full items-center justify-center bg-ink text-[14px] font-medium text-paper"
                >
                  {customer ? accountLabel : "Sign in"}
                </Link>
              </motion.section>

              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.4, ease: EASE_OUT_EXPO }}
                className="mt-8 border-t border-ink/10 pt-6"
                aria-label="Support"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Support
                </p>
                <Link
                  href={CONTACT_HREF}
                  className="mt-3 flex min-h-11 items-center text-[15px] text-ink-mute transition-colors hover:text-ink"
                >
                  Contact
                </Link>
              </motion.nav>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
