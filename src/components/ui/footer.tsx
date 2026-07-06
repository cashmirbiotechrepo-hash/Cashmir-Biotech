'use client';

import React from 'react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FlaskConical, Mail, MapPin, Microscope } from 'lucide-react';

interface FooterLink {
  title: string;
  href: string;
}

interface FooterSection {
  label: string;
  links: FooterLink[];
}

const footerLinks: FooterSection[] = [
  {
    label: 'Formulations',
    links: [
      { title: 'Product catalog', href: '/products' },
      { title: 'Magic Food TaxO', href: '/products' },
      { title: 'Institutional orders', href: 'mailto:contact@cashmirbiotech.com' }
    ]
  },
  {
    label: 'Science',
    links: [
      { title: 'Patent registry', href: '/patents' },
      { title: 'Research archive', href: '/patents' }
    ]
  },
  {
    label: 'Company',
    links: [
      { title: 'Home', href: '/' },
      { title: 'Board members', href: '/team' },
      { title: 'Admin console', href: '/admin/login' }
    ]
  }
];

const STANDARDS = ['SKUAST-K aligned', 'GMP discipline', 'LC-MS verification', 'Kashmir origin'];

const linkClass =
  'inline-flex min-h-9 cursor-pointer items-center text-sm text-on-muted transition duration-200 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto mt-24 w-[calc(100%-1.25rem)] max-w-[1320px] md:w-[calc(100%-2rem)]"
    >
      <div className="home-grain relative overflow-hidden rounded-[2rem] border border-outline-variant/20 bg-gradient-to-b from-surface-container-low via-surface-container to-surface-container-high px-6 py-12 md:px-10 md:py-14">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
          aria-hidden
        />

        <div className="grid gap-12 xl:grid-cols-[1.05fr_1fr] xl:gap-16">
          <AnimatedContainer className="space-y-6">
            <Link href="/" className={linkClass}>
              <span className="flex items-center gap-3 text-heading hover:text-primary">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                  <FlaskConical className="h-5 w-5 text-primary" aria-hidden />
                </span>
                <span className="text-xl font-medium tracking-[-0.02em] [font-family:var(--font-headline)]">
                  Cashmir Biotech
                </span>
              </span>
            </Link>

            <p className="text-pretty max-w-md text-sm leading-[1.8] text-on-surface/70">
              Himalayan phyto intelligence translated into research-grade formulations — patented pathways, transparent
              labeling, and manufacturing discipline built for institutions and informed consumers.
            </p>

            <div className="flex flex-wrap gap-2">
              {STANDARDS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-outline-variant/25 bg-surface/50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-on-muted"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="space-y-3 border-t border-outline-variant/20 pt-6 text-sm text-on-muted">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
                <span>Kashmir, India — alpine biodiversity corridors</span>
              </p>
              <a href="mailto:contact@cashmirbiotech.com" className={linkClass}>
                <Mail className="me-2 h-4 w-4 text-primary/70" aria-hidden />
                contact@cashmirbiotech.com
              </a>
            </div>
          </AnimatedContainer>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerLinks.map((section, index) => (
              <AnimatedContainer key={section.label} delay={0.08 + index * 0.06}>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">{section.label}</h3>
                <ul className="mt-5 space-y-2">
                  {section.links.map((link) => (
                    <li key={`${section.label}-${link.title}`}>
                      {link.href.startsWith('/') ? (
                        <Link href={link.href} className={linkClass}>
                          {link.title}
                        </Link>
                      ) : (
                        <a href={link.href} className={linkClass}>
                          {link.title}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </AnimatedContainer>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-outline-variant/20 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-on-muted">
            © {new Date().getFullYear()} Cashmir Biotech Pvt Ltd. All rights reserved.
          </p>
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-on-muted">
            <Microscope className="h-3.5 w-3.5 text-primary/60" aria-hidden />
            Research-grade formulation standards
          </p>
        </div>
      </div>
    </motion.footer>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>['className'];
  children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
  const reducedPref = useReducedMotion();
  const [motionReady, setMotionReady] = React.useState(false);
  React.useEffect(() => setMotionReady(true), []);
  const shouldReduceMotion = motionReady && Boolean(reducedPref);

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
