"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, MapPin, Phone } from "lucide-react";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { SITE_CONTACT } from "@/lib/site-contact";

type FooterLink = { label: string; href: string };
type FooterColumn = { title: string; links: FooterLink[] };

const COLUMNS: FooterColumn[] = [
  {
    title: "Formulations",
    links: [
      { label: "Product catalog", href: "/products" },
      { label: "Institutional inquiry", href: `mailto:${SITE_CONTACT.primaryEmail}` }
    ]
  },
  {
    title: "Science",
    links: [
      { label: "Bioinformatics suite", href: "/tools" },
      { label: "Patent registry", href: "/patents" },
      { label: "Certifications", href: "/about" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "Home", href: "/" },
      { label: "About us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Board members", href: "/team" },
      { label: "Customer Portal", href: "/portal/login" },
      { label: "Operations Console", href: "/admin/login" }
    ]
  }
];

type ConnectLink = { label: string; href: string; icon: ComponentType<{ className?: string }> };

const CONNECT: ConnectLink[] = [
  { label: SITE_CONTACT.primaryEmail, href: `mailto:${SITE_CONTACT.primaryEmail}`, icon: Mail },
  { label: SITE_CONTACT.phone, href: `tel:${SITE_CONTACT.phoneTel}`, icon: Phone },
  { label: SITE_CONTACT.location, href: SITE_CONTACT.mapsUrl, icon: MapPin }
];

type AnimatedProps = { children: ReactNode; className?: string; delay?: number };

/** Staggered blur-and-rise reveal as sections scroll into view. */
function AnimatedContainer({ children, className, delay = 0.1 }: AnimatedProps) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  // Defer motion until after mount so server and client markup match (avoids a
  // hydration mismatch on the reduced-motion / initial-style attributes).
  useEffect(() => setMounted(true), []);

  if (reduce || !mounted) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ filter: "blur(4px)", y: -8, opacity: 0 }}
      whileInView={{ filter: "blur(0px)", y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay, duration: 0.8, ease: EASE_OUT_EXPO }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-ink/10 bg-ivory">
      {/* Centered hairline glow along the top edge. */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/50 blur-sm" />

      <div className="frame py-20">
        <div className="grid gap-14 xl:grid-cols-3 xl:gap-10">
          <AnimatedContainer className="space-y-5">
            <Image
              src="/logo.png"
              alt="Cashmir Biotech"
              width={280}
              height={230}
              className="h-16 w-auto"
            />
            <p className="max-w-xs text-sm leading-relaxed text-ink-mute">
              Precision biology from Himalayan biodiversity — patented actives engineered
              under clinical discipline.
            </p>
            <p className="technical">SKUAST-K · GMP · LC-MS</p>
          </AnimatedContainer>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 xl:col-span-2">
            {COLUMNS.map((col, index) => (
              <AnimatedContainer key={col.title} delay={0.1 + index * 0.1}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  {col.title}
                </p>
                <ul className="mt-5 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="group inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
                      >
                        <span className="text-gold opacity-0 transition-opacity group-hover:opacity-100">
                          +
                        </span>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </AnimatedContainer>
            ))}

            <AnimatedContainer delay={0.1 + COLUMNS.length * 0.1}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Connect
              </p>
              <ul className="mt-5 space-y-3">
                {CONNECT.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        target={item.href.startsWith("http") ? "_blank" : undefined}
                        rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                        className="group inline-flex items-center gap-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/10 text-ink-mute transition-colors duration-300 group-hover:border-gold/50 group-hover:text-gold">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="break-all">{item.label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </AnimatedContainer>
          </div>
        </div>

        <AnimatedContainer delay={0.5}>
          <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-ink/10 pt-8 md:flex-row md:items-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              © {year} Cashmir Biotech Pvt Ltd. All rights reserved.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Kashmir, India
            </p>
          </div>
        </AnimatedContainer>
      </div>
    </footer>
  );
}
