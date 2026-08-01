"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, ShoppingBag, Menu, X, Sun, Moon } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useCart } from "@/components/shop/cart-context";
import { cn } from "@/lib/utils";
import { ThemeSegment } from "@/components/experience/theme-toggle";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

type NavLink = { label: string; href: string; category?: "primary" | "secondary" };

const PRIMARY_LINKS: NavLink[] = [
  { label: "Shop", href: "/products", category: "primary" },
  { label: "Research", href: "/research", category: "primary" },
  { label: "Technology", href: "/technology", category: "primary" },
  { label: "Patents", href: "/patents", category: "primary" }
];

const SECONDARY_LINKS: NavLink[] = [
  { label: "Company", href: "/about", category: "secondary" },
  { label: "Journal", href: "/blog", category: "secondary" }
];

const LINKS = [...PRIMARY_LINKS, ...SECONDARY_LINKS];

function isActive(pathname: string, href: string) {
  return href !== "/" && pathname.startsWith(href);
}

/**
 * GSAP-animated Navigation Link item
 */
function AnimatedNavLink({ link, active }: { link: NavLink; active: boolean }) {
  const container = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLAnchorElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    gsap.set(lineRef.current, { scaleX: active ? 1 : 0, transformOrigin: "center" });
  }, { scope: container, dependencies: [active] });

  const { contextSafe } = useGSAP({ scope: container });

  const onEnter = contextSafe(() => {
    if (active) return;
    gsap.to(textRef.current, { color: "var(--ink)", duration: 0.25, ease: "power2.out" });
    gsap.to(lineRef.current, { scaleX: 1, duration: 0.35, ease: "back.out(1.7)" });
  });

  const onLeave = contextSafe(() => {
    if (active) return;
    gsap.to(textRef.current, { color: "var(--ink-mute)", duration: 0.25, ease: "power2.out" });
    gsap.to(lineRef.current, { scaleX: 0, duration: 0.35, ease: "power2.out" });
  });

  return (
    <li ref={container} className="relative flex items-center py-1" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <Link
        ref={textRef}
        href={link.href}
        className="relative block text-[14px] font-medium transition-colors duration-200"
        style={{ color: active ? "var(--ink)" : "var(--ink-mute)" }}
      >
        <span>{link.label}</span>
        <span className="absolute -bottom-1.5 left-1/2 flex h-[2px] w-[16px] -translate-x-1/2 items-center justify-center overflow-hidden">
          <span
            ref={lineRef}
            className="block h-full w-full bg-gold rounded-full"
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * Animated Utility Icon Button
 */
function AnimatedIconButton({ 
  children, 
  onClick, 
  href, 
  ariaLabel,
  badge
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  href?: string; 
  ariaLabel: string;
  badge?: React.ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const iconWrapper = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: container });

  const onEnter = contextSafe(() => {
    gsap.to(container.current, { color: "var(--ink)", duration: 0.2, ease: "power2.out" });
    gsap.to(iconWrapper.current, { scale: 1.1, duration: 0.3, ease: "back.out(2)" });
  });

  const onLeave = contextSafe(() => {
    gsap.to(container.current, { color: "var(--ink-mute)", duration: 0.2, ease: "power2.out" });
    gsap.to(iconWrapper.current, { scale: 1, duration: 0.3, ease: "power2.out" });
  });

  const inner = (
    <>
      <div ref={iconWrapper} className="flex items-center justify-center">
        {children}
      </div>
      {badge}
    </>
  );

  const className = "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-ink/5";
  const style = { color: "var(--ink-mute)" };

  if (href) {
    return (
      <div ref={container} onMouseEnter={onEnter} onMouseLeave={onLeave} className={className} style={style}>
        <Link href={href} aria-label={ariaLabel} className="absolute inset-0 flex items-center justify-center">
          {inner}
        </Link>
      </div>
    );
  }

  return (
    <div ref={container} onMouseEnter={onEnter} onMouseLeave={onLeave} className={className} style={style}>
      <button type="button" onClick={onClick} aria-label={ariaLabel} className="absolute inset-0 flex items-center justify-center">
        {inner}
      </button>
    </div>
  );
}

/**
 * Sun / Moon Theme Toggle
 */
function HeaderThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const sunRef = useRef<SVGSVGElement>(null);
  const moonRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") as "light" | "dark" | null;
    if (current) setTheme(current);
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          const t = root.getAttribute("data-theme") as "light" | "dark";
          if (t) setTheme(t);
        }
      });
    });
    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useGSAP(() => {
    if (theme === "dark") {
      gsap.to(sunRef.current, { rotate: 180, scale: 0, opacity: 0, duration: 0.3, ease: "back.in(1.4)" });
      gsap.to(moonRef.current, { rotate: 0, scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.4)", delay: 0.05 });
    } else {
      gsap.to(moonRef.current, { rotate: -180, scale: 0, opacity: 0, duration: 0.3, ease: "back.in(1.4)" });
      gsap.to(sunRef.current, { rotate: 0, scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.4)", delay: 0.05 });
    }
  }, [theme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("cb_theme", next);
    } catch {}
  }

  return (
    <AnimatedIconButton onClick={toggle} ariaLabel="Toggle theme">
      <div className="relative flex h-4 w-4 items-center justify-center">
        <Sun ref={sunRef} className="absolute inset-0 h-4 w-4" strokeWidth={2} />
        <Moon ref={moonRef} className="absolute inset-0 h-4 w-4" strokeWidth={2} />
      </div>
    </AnimatedIconButton>
  );
}

export function SiteNav({
  customer = null
}: {
  customer?: { name: string | null; email: string } | null;
}) {
  const { count, ready: cartReady } = useCart();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useGSAP(() => {
    if (!navRef.current) return;

    if (isScrolled) {
      // Detached floating pill state
      gsap.to(navRef.current, {
        marginTop: 12,
        maxWidth: "1024px",
        borderRadius: "9999px",
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 24,
        paddingRight: 24,
        backgroundColor: "rgb(var(--paper) / 0.85)",
        borderColor: "rgb(var(--ink) / 0.12)",
        boxShadow: "0 12px 32px -8px rgba(0, 0, 0, 0.08)",
        backdropFilter: "blur(20px) saturate(160%)",
        duration: 0.5,
        ease: "power3.out"
      });
    } else {
      // Attached top header state (100% transparent blend with hero background)
      gsap.to(navRef.current, {
        marginTop: 0,
        maxWidth: "100%",
        borderRadius: "0px",
        paddingTop: 14,
        paddingBottom: 14,
        paddingLeft: 32,
        paddingRight: 32,
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderBottomColor: "transparent",
        boxShadow: "0 0px 0px rgba(0, 0, 0, 0)",
        backdropFilter: "blur(0px)",
        duration: 0.5,
        ease: "power3.out"
      });
    }
  }, { dependencies: [isScrolled] });

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

  const accountHref = customer ? "/portal" : "/portal/login?next=/portal";

  return (
    <header className="fixed top-0 inset-x-0 z-50 w-full">
      <nav
        ref={navRef}
        aria-label="Primary Navigation"
        className="mx-auto border-b border-transparent transition-none"
        style={{
          marginTop: 0,
          maxWidth: "100%",
          borderRadius: 0,
          paddingTop: 14,
          paddingBottom: 14,
          paddingLeft: 32,
          paddingRight: 32,
          backgroundColor: "transparent",
          backdropFilter: "none"
        }}
      >
        <div className="relative flex items-center justify-between gap-4">
          {/* Left: Branding — ~15% larger with breathing room */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              aria-label="Cashmir Biotech home"
              className="group flex items-center transition-opacity hover:opacity-85"
            >
              <div className="relative h-7 w-28 sm:h-8 sm:w-32 shrink-0 overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="Cashmir Biotech Logo"
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>
            </Link>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <div className="absolute inset-0 m-auto hidden size-fit lg:block">
            <ul className="flex items-center gap-7 text-[14px]">
              {LINKS.map((link) => (
                <AnimatedNavLink
                  key={link.href}
                  link={link}
                  active={isActive(pathname, link.href)}
                />
              ))}
            </ul>
          </div>

          {/* Right Utilities — Streamlined for Mobile (Search, Cart, Menu) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Desktop Only: Theme & Account */}
            <div className="hidden lg:flex items-center gap-1">
              <HeaderThemeToggle />
              <AnimatedIconButton href={accountHref} ariaLabel="Account">
                <User className="h-4 w-4" strokeWidth={2} />
              </AnimatedIconButton>
            </div>

            {/* Mobile & Desktop: Search & Cart */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <AnimatedIconButton ariaLabel="Search">
                <Search className="h-[18px] w-[18px]" strokeWidth={2} />
              </AnimatedIconButton>

              <AnimatedIconButton
                href="/cart"
                ariaLabel="Cart"
                badge={
                  cartReady && count > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-gold px-1 font-mono text-[9px] font-bold text-white shadow-sm">
                      {count > 99 ? "99+" : count}
                    </span>
                  )
                }
              >
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2} />
              </AnimatedIconButton>
            </div>

            {/* Mobile Menu Hamburger Toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close Menu" : "Open Menu"}
              className="relative flex h-9.5 w-9.5 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 lg:hidden"
            >
              {menuOpen ? (
                <X className="h-5 w-5" strokeWidth={2} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Menu — Full UX Architecture */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper text-ink lg:hidden animate-in fade-in slide-in-from-top-3 duration-200 overflow-y-auto">
          {/* Menu Drawer Header Bar */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink/10 px-6">
            <Link href="/" onClick={() => setMenuOpen(false)} aria-label="Cashmir Biotech home">
              <div className="relative h-7 w-28 shrink-0 overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="Cashmir Biotech"
                  fill
                  className="object-contain object-left"
                />
              </div>
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          {/* Menu Drawer Content */}
          <div className="flex flex-1 flex-col px-6 py-6">
            <nav aria-label="Mobile Navigation" className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-3">
                Navigation
              </p>

              {/* Primary Section */}
              <ul className="flex flex-col gap-3">
                {PRIMARY_LINKS.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex items-center justify-between py-2 text-2xl font-light tracking-tight transition-colors",
                          active ? "text-gold font-normal" : "text-ink hover:text-gold"
                        )}
                      >
                        <span>{link.label}</span>
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="my-5 h-px bg-ink/10" />

              {/* Secondary Section */}
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-3">
                Explore
              </p>
              <ul className="flex flex-col gap-2.5">
                {SECONDARY_LINKS.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "block py-1 text-lg font-normal transition-colors",
                          active ? "text-gold font-medium" : "text-ink-soft hover:text-ink"
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="my-5 h-px bg-ink/10" />

              {/* Account & Utilities */}
              <div className="flex flex-col gap-3">
                <Link
                  href={accountHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 py-1.5 text-base font-medium text-ink transition-colors hover:text-gold"
                >
                  <User className="h-4.5 w-4.5 text-ink-mute" strokeWidth={1.8} />
                  {customer ? "My Account" : "Sign In / Register"}
                </Link>
                <Link
                  href="/cart"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between py-1.5 text-base font-medium text-ink transition-colors hover:text-gold"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingBag className="h-4.5 w-4.5 text-ink-mute" strokeWidth={1.8} />
                    Shopping Cart
                  </span>
                  {cartReady && count > 0 && (
                    <span className="rounded-full bg-gold px-2 py-0.5 font-mono text-xs text-white">
                      {count}
                    </span>
                  )}
                </Link>
              </div>

              {/* Appearance / Theme Control */}
              <div className="mt-6 border-t border-ink/10 pt-5">
                <ThemeSegment />
              </div>
            </nav>

            {/* Menu Footer */}
            <div className="mt-8 border-t border-ink/10 pt-4 flex items-center justify-between text-[12px] text-ink-mute">
              <span>© {new Date().getFullYear()} Cashmir Biotech</span>
              <div className="flex items-center gap-3">
                <Link href="/about" onClick={() => setMenuOpen(false)} className="hover:text-ink">
                  Support
                </Link>
                <span>·</span>
                <Link href="/about" onClick={() => setMenuOpen(false)} className="hover:text-ink">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
