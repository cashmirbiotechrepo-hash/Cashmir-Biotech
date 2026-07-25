"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
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

  // Keep the latest menu state in a ref so the scroll handler never re-subscribes.
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;

  // Native scroll listener: fires reliably during Lenis' rAF-driven scrolling,
  // where Framer's useScroll motion value can stay pinned at 0.
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

  // Close the drawer on route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock scroll while the mobile drawer is open.
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [menuOpen]);

  return (
    <>
      <motion.header
        initial={{ y: -140, opacity: 0 }}
        animate={
          ready
            ? { y: hidden ? -140 : 0, opacity: hidden ? 0 : 1 }
            : { y: -140, opacity: 0 }
        }
        transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
        style={{ willChange: "transform, opacity" }}
        className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
      >
        <nav
          className={cn(
            "flex w-full max-w-frame items-center justify-between rounded-full px-5 transition-[padding,background-color,box-shadow,backdrop-filter] duration-500 ease-expo md:px-7",
            condensed || menuOpen ? "glass-strong py-2.5 shadow-premium" : "py-4"
          )}
        >
          <Link
            href="/"
            className="flex items-center"
            aria-label="Cashmir Biotech home"
          >
            <span className="logo-plate">
              <Image
                src="/logo.png"
                alt="Cashmir Biotech"
                width={240}
                height={197}
                priority
                className={cn(
                  "w-auto transition-all duration-500 ease-expo",
                  condensed || menuOpen ? "h-9" : "h-11"
                )}
              />
            </span>
          </Link>

          <ul className="hidden items-center gap-9 md:flex">
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

          <div className="flex items-center gap-3 md:gap-3.5">
            {/* Hide the icon toggle while the drawer is open — theme lives in the
                Day/Night segment below, so two moons don't stack. */}
            <div className={cn(menuOpen && "invisible pointer-events-none md:visible md:pointer-events-auto")}>
              <ThemeToggle />
            </div>
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
              ) : (
                <span className="hidden sm:inline">{accountLabel}</span>
              )}
              {!accountInitials ? (
                <span className="sm:hidden rounded-full border border-ink/15 px-3 py-2 text-[11px] text-ink">
                  Sign in
                </span>
              ) : (
                <span className="hidden lg:inline">{accountLabel}</span>
              )}
            </Link>
            <Link
              href="/cart"
              data-cursor="Cart"
              aria-label={cartReady && count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
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
              className="group relative hidden items-center gap-2 overflow-hidden rounded-full border border-ink/15 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink transition-colors hover:border-ink md:inline-flex"
            >
              <span className="relative z-10 transition-colors duration-500 group-hover:text-paper">
                Contact
              </span>
              <span className="absolute inset-0 origin-left scale-x-0 rounded-full bg-ink transition-transform duration-500 ease-expo group-hover:scale-x-100" />
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 md:hidden"
            >
              <span className="relative flex h-3 w-4 flex-col justify-between">
                <span
                  className={cn(
                    "h-px w-full origin-center bg-ink transition-transform duration-300",
                    menuOpen && "translate-y-[5.5px] rotate-45"
                  )}
                />
                <span
                  className={cn(
                    "h-px w-full bg-ink transition-opacity duration-300",
                    menuOpen && "opacity-0"
                  )}
                />
                <span
                  className={cn(
                    "h-px w-full origin-center bg-ink transition-transform duration-300",
                    menuOpen && "-translate-y-[5.5px] -rotate-45"
                  )}
                />
              </span>
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="fixed inset-0 z-40 flex flex-col bg-paper/95 px-6 pb-10 pt-28 backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {LINKS.map((link, i) => (
                <motion.li
                  key={link.href}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08 + i * 0.06, ease: EASE_OUT_EXPO }}
                  className="border-b border-ink/10"
                >
                  <Link
                    href={link.href}
                    className="flex items-center justify-between py-5 text-3xl font-light tracking-tight text-ink"
                  >
                    {link.label}
                    <span className="font-mono text-xs text-gold">0{i + 1}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: EASE_OUT_EXPO }}
              className="mt-auto flex flex-col"
            >
              <ThemeSegment className="pb-5" />

              <div className="hairline-x mb-5 h-px w-full" />

              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/cart"
                  className="flex items-center justify-center gap-2 rounded-full bg-ink/[0.05] py-3.5 text-[13px] font-medium text-ink transition-colors active:bg-ink/[0.09]"
                >
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.6} />
                  Cart
                  {cartReady && count > 0 ? (
                    <span className="font-mono text-[11px] text-gold">{count}</span>
                  ) : null}
                </Link>
                <Link
                  href={accountHref}
                  className="flex items-center justify-center rounded-full bg-ink py-3.5 text-[13px] font-medium text-paper"
                >
                  {customer ? accountLabel : "Sign in"}
                </Link>
              </div>

              <Link
                href={CONTACT_HREF}
                className="mt-3 flex items-center justify-center py-3 text-[13px] text-ink-mute transition-colors hover:text-ink"
              >
                Contact us
              </Link>
              <Link
                href="/admin/login"
                className="pt-1 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint"
              >
                Admin console
              </Link>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
