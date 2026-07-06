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
      { label: 'Board Members', href: '/team', description: 'Leadership and advisors' },
      { label: 'Patents & Research', href: '/patents', description: 'Our scientific registry' },
    ],
  },
  { label: 'Our Products', href: '/products' },
  { label: 'Patents', href: '/patents' },
  { label: 'Contact Us', href: 'mailto:contact@cashmirbiotech.com' },
];

export function Header2() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const scrolled = useScroll(10);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const isScrolled = mounted ? scrolled : false;

  return (
    <header
      suppressHydrationWarning
      className={cn(
        'sticky top-3 md:top-4 z-50 mx-auto w-[calc(100%-1.5rem)] md:w-[calc(100%-2rem)] max-w-6xl transition-all duration-300 ease-out',
        {
          'rounded-2xl bg-surface/90 supports-[backdrop-filter]:bg-surface/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]':
            isScrolled && !open,
          'rounded-2xl bg-transparent': !isScrolled && !open,
          'rounded-2xl bg-surface/95 backdrop-blur-xl': open,
        }
      )}
    >
      <nav
        className={cn(
          'flex w-full items-center justify-between px-4 transition-all duration-300 ease-out',
          scrolled ? 'h-16 md:h-16 md:px-6' : 'h-20 md:h-20 md:px-4'
        )}
      >
        {/* Restore Original Cashmir Biotech Logo */}
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

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex md:flex-1 md:justify-center">
          {NAV_ITEMS.map((item) =>
            'href' in item ? (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'rounded-full px-4 font-medium transition-colors hover:bg-primary/10 hover:text-primary',
                  pathname === item.href || pathname?.startsWith(item.href + '/') ? 'text-primary bg-primary/5' : 'text-on-muted hover:text-heading'
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
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'flex items-center gap-1 rounded-full px-4 font-medium transition-colors hover:bg-primary/10 hover:text-primary',
                    dropdownOpen === item.label ? 'bg-primary/10 text-primary' : 'text-on-muted hover:text-heading'
                  )}
                  aria-expanded={dropdownOpen === item.label}
                >
                  {item.label}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 opacity-70 transition-transform duration-300',
                      dropdownOpen === item.label && 'rotate-180'
                    )}
                  />
                </button>
                <AnimatePresence>
                  {dropdownOpen === item.label && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2"
                    >
                      <div className="rounded-2xl bg-surface/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
                        {item.children.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className="group flex flex-col gap-0.5 rounded-xl px-4 py-3 text-left transition-colors hover:bg-primary/10"
                          >
                            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-heading group-hover:text-primary">
                              {sub.label}
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </span>
                            {sub.description && (
                              <span className="text-xs text-on-muted">{sub.description}</span>
                            )}
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

        <div className="hidden items-center gap-3 md:flex shrink-0">
          <Link
            href="/admin/login"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-10 rounded-full border-none bg-surface-container-low text-[12px] font-semibold uppercase tracking-wider hover:bg-primary/10 hover:text-primary'
            )}
          >
            Sign In
          </Link>
          <Link
            href="/products"
            className={cn(
              buttonVariants({ variant: 'default' }),
              'h-10 rounded-full bg-primary-brand font-semibold text-on-primary-container shadow-[0_4px_14px_rgba(234,179,8,0.25)] hover:brightness-110'
            )}
          >
            Get Started
          </Link>
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="md:hidden h-10 w-10 rounded-xl border-none bg-surface-container-low/50 hover:bg-surface-container-high"
        >
          <MenuToggleIcon open={open} className="size-5 text-heading" duration={300} />
        </Button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden mt-2 rounded-2xl bg-surface/95 backdrop-blur-xl overflow-hidden shadow-xl"
          >
            <div className="flex flex-col gap-2 p-4">
              {NAV_ITEMS.map((item) =>
                'href' in item ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({ variant: 'ghost', className: 'justify-start' }),
                      'rounded-xl text-base font-semibold',
                      pathname === item.href ? 'bg-primary/10 text-primary' : 'text-heading'
                    )}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label} className="py-2">
                    <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-on-muted">
                      {item.label}
                    </p>
                    <div className="flex flex-col gap-1 pl-4 ml-2">
                      {item.children.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpen(false)}
                          className="flex flex-col rounded-xl px-4 py-2 text-heading hover:bg-primary/5 hover:text-primary transition-colors"
                        >
                          <span className="font-semibold text-sm">{sub.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              )}
              <div className="mt-4 flex flex-col gap-3 pt-4 border-t border-surface-container">
                <Link
                  href="/admin/login"
                  onClick={() => setOpen(false)}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'w-full h-12 rounded-xl border-none bg-surface-container-low font-semibold'
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href="/products"
                  onClick={() => setOpen(false)}
                  className={cn(
                    buttonVariants({ variant: 'default' }),
                    'w-full h-12 rounded-xl bg-primary-brand font-semibold text-on-primary-container'
                  )}
                >
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
