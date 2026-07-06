'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, FlaskConical, ArrowUpRight } from 'lucide-react';

type NavItem =
  | { label: string; href: string }
  | {
      label: string;
      children: { label: string; href: string; description?: string }[];
    };

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Company',
    children: [
      { label: 'Board members', href: '/team', description: 'Leadership and scientific advisors' },
      { label: 'Patents & research', href: '/patents', description: 'Published filings and registry' }
    ]
  },
  { label: 'Catalog', href: '/products' },
  { label: 'Patents', href: '/patents' },
  { label: 'Contact', href: 'mailto:contact@cashmirbiotech.com' }
];

const linkFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function isActive(pathname: string | null, href: string) {
  if (href.startsWith('mailto:')) return false;
  return pathname === href || Boolean(pathname?.startsWith(href + '/'));
}

export function Header2() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const scrolled = useScroll(14);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpen(false);
    setDropdownOpen(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setDropdownOpen(null);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const isScrolled = mounted ? scrolled : false;

  return (
    <header
      suppressHydrationWarning
      className={cn(
        'sticky top-3 z-50 mx-auto w-[calc(100%-1.25rem)] max-w-[1320px] transition-all duration-300 ease-out md:top-4 md:w-[calc(100%-2rem)]',
        open ? 'rounded-2xl border border-outline-variant/25 bg-surface-container-low/95 shadow-[0_20px_50px_rgb(0_0_0/0.35)] backdrop-blur-xl' : '',
        isScrolled && !open
          ? 'rounded-2xl border border-outline-variant/20 bg-surface-container-low/80 shadow-[0_16px_48px_rgb(0_0_0/0.28)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface-container-low/65'
          : '',
        !isScrolled && !open ? 'rounded-2xl border border-transparent bg-transparent' : ''
      )}
    >
      <a
        href="#main-content"
        className={cn(
          'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground',
          linkFocus
        )}
      >
        Skip to content
      </a>

      <nav
        className={cn(
          'flex w-full items-center justify-between px-4 transition-all duration-300 md:px-6',
          isScrolled ? 'h-16' : 'h-[4.25rem] md:h-20'
        )}
        aria-label="Main"
      >
        <Link
          href="/"
          className={cn('group flex min-w-0 shrink-0 items-center gap-3', linkFocus)}
          onClick={() => setOpen(false)}
        >
          <span className="home-specimen-ring relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-surface-container/80 shadow-[0_0_20px_rgb(234_179_8/0.1)] transition duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_28px_rgb(234_179_8/0.18)]">
            <FlaskConical className="relative z-10 h-[18px] w-[18px] text-primary" aria-hidden />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">Cashmir</span>
            <span className="mt-1 text-lg font-medium tracking-[-0.02em] text-heading [font-family:var(--font-headline)]">
              Biotech
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex md:flex-1 md:justify-center">
          {NAV_ITEMS.map((item) =>
            'href' in item ? (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'cursor-pointer rounded-lg px-4 text-sm font-medium transition duration-200 hover:bg-primary/8 hover:text-primary',
                  linkFocus,
                  isActive(pathname, item.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-muted hover:text-heading'
                )}
              >
                {item.label}
              </Link>
            ) : (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setDropdownOpen(item.label)}
                onMouseLeave={() => setDropdownOpen(null)}
              >
                <button
                  type="button"
                  onClick={() => setDropdownOpen(dropdownOpen === item.label ? null : item.label)}
                  onFocus={() => setDropdownOpen(item.label)}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'flex cursor-pointer items-center gap-1 rounded-lg px-4 text-sm font-medium transition duration-200 hover:bg-primary/8 hover:text-primary',
                    linkFocus,
                    dropdownOpen === item.label ? 'bg-primary/10 text-primary' : 'text-on-muted hover:text-heading'
                  )}
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen === item.label}
                >
                  {item.label}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 opacity-70 transition-transform duration-300',
                      dropdownOpen === item.label && 'rotate-180'
                    )}
                    aria-hidden
                  />
                </button>
                <AnimatePresence>
                  {dropdownOpen === item.label && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2"
                    >
                      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/95 p-2 shadow-[0_24px_60px_rgb(0_0_0/0.45)] backdrop-blur-xl">
                        {item.children.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              'group flex cursor-pointer flex-col gap-1 rounded-xl px-4 py-3 text-left transition duration-200 hover:bg-primary/10',
                              linkFocus
                            )}
                          >
                            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-heading group-hover:text-primary">
                              {sub.label}
                              <ArrowUpRight
                                className="h-3.5 w-3.5 shrink-0 opacity-40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                aria-hidden
                              />
                            </span>
                            {sub.description ? (
                              <span className="text-xs leading-relaxed text-on-muted">{sub.description}</span>
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

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            href="/admin/login"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-10 cursor-pointer rounded-lg border-outline-variant/30 bg-transparent px-4 text-xs font-semibold uppercase tracking-[0.14em] text-on-muted hover:border-primary/35 hover:bg-primary/8 hover:text-primary',
              linkFocus
            )}
          >
            Admin
          </Link>
          <Link
            href="/products"
            className={cn(
              buttonVariants({ variant: 'default' }),
              'h-10 cursor-pointer rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_32px_rgb(234_179_8/0.2)] transition duration-300 hover:brightness-110 motion-safe:hover:-translate-y-0.5',
              linkFocus
            )}
          >
            Explore catalog
          </Link>
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className={cn(
            'h-11 w-11 cursor-pointer rounded-xl border-outline-variant/25 bg-surface-container-low/60 hover:bg-surface-container-high md:hidden',
            linkFocus
          )}
        >
          <MenuToggleIcon open={open} className="size-5 text-heading" duration={300} />
        </Button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-outline-variant/15 md:hidden"
          >
            <div className="flex flex-col gap-1 p-4">
              {NAV_ITEMS.map((item) =>
                'href' in item ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({ variant: 'ghost', className: 'justify-start' }),
                      'cursor-pointer rounded-xl text-base font-medium',
                      linkFocus,
                      isActive(pathname, item.href) ? 'bg-primary/10 text-primary' : 'text-heading'
                    )}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label} className="py-2">
                    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-on-muted">
                      {item.label}
                    </p>
                    <div className="flex flex-col gap-1 pl-2">
                      {item.children.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'cursor-pointer rounded-xl px-3 py-2.5 text-heading transition duration-200 hover:bg-primary/8 hover:text-primary',
                            linkFocus
                          )}
                        >
                          <span className="text-sm font-semibold">{sub.label}</span>
                          {sub.description ? (
                            <span className="mt-0.5 block text-xs text-on-muted">{sub.description}</span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              )}
              <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/20 pt-4">
                <Link
                  href="/admin/login"
                  onClick={() => setOpen(false)}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'h-12 w-full cursor-pointer rounded-xl border-outline-variant/30 font-semibold',
                    linkFocus
                  )}
                >
                  Admin
                </Link>
                <Link
                  href="/products"
                  onClick={() => setOpen(false)}
                  className={cn(
                    buttonVariants({ variant: 'default' }),
                    'h-12 w-full cursor-pointer rounded-xl bg-primary font-semibold text-primary-foreground',
                    linkFocus
                  )}
                >
                  Explore catalog
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
