"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Beaker,
  Building2,
  Circle,
  FileCheck,
  FlaskConical,
  Lock,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  Truck,
  Trash2
} from "lucide-react";
import { useCart, type CartItem } from "@/components/shop/cart-context";
import { Reveal } from "@/components/ui/reveal";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { cn } from "@/lib/utils";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const FREE_SHIPPING_THRESHOLD = 999;
const FLAT_SHIPPING = 60;

const BATCH_LABEL = "Current batch · July 2026";

const INCLUDED = [
  { label: "Formula unit as sized", icon: Package },
  { label: "Batch verification on dispatch", icon: FlaskConical },
  { label: "Manufacturing documentation", icon: FileCheck },
  { label: "Patent registry access", icon: ShieldCheck },
  { label: "GST invoice", icon: FileCheck },
  { label: "Lot number on packing", icon: Beaker },
  { label: "Usage guidance PDF", icon: FileCheck }
] as const;

const FAQ = [
  {
    q: "When does this ship?",
    a: "Assayed lots are prepared and dispatched within approximately seven days of payment. You receive tracking once the courier is assigned."
  },
  {
    q: "Can I request batch / CoA documents?",
    a: "Yes. Reply to your order confirmation or contact support — lot documents are available on request for research and institutional buyers."
  },
  {
    q: "Is GST included?",
    a: "A GST invoice is issued with your order. Pricing shown at checkout is what you pay — no hidden fees."
  },
  {
    q: "What if I need to return it?",
    a: "Contact support with your order number. We handle returns under our standard policy once the lot condition is confirmed."
  }
] as const;

function Money({ value, className }: { value: number; className?: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
        className={cn("inline-block tabular-nums", className)}
      >
        {inr.format(value)}
      </motion.span>
    </AnimatePresence>
  );
}

function productStory(name: string) {
  return `${name} is a patent-backed nutraceutical developed through SKUAST-K biotechnology research — assayed before it reaches you.`;
}

export function CartView({ patentCount = 0 }: { patentCount?: number }) {
  const { items, ready, subtotalInr, setQuantity, remove } = useCart();
  const router = useRouter();

  const trustCards = [
    {
      title: "Patent protected",
      body:
        patentCount > 0
          ? `Backed by ${patentCount} patent${patentCount === 1 ? "" : "s"} in the Cashmir portfolio — composition and method IP you can inspect in our registry.`
          : "Composition and method IP from Cashmir's patent portfolio — inspect filings in our public registry."
    },
    {
      title: "Clinically developed",
      body: "Developed through university-led biotechnology research with faculty and students at SKUAST-K."
    },
    {
      title: "Manufactured with care",
      body: "Produced under GMP-aligned manufacturing protocols with documentation retained for each lot."
    },
    {
      title: "Quality assured",
      body: "Every production lot undergoes batch verification before dispatch. Lot identifiers travel with the unit."
    }
  ] as const;

  if (!ready) {
    return (
      <div className="frame pt-28 md:pt-32">
        <div className="h-48 animate-pulse bg-pearl/80" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="frame pb-8 pt-28 md:pt-32">
        <Reveal>
          <p className="text-[12px] text-ink-soft">Your formula</p>
          <h1 className="mt-2 max-w-[14ch] text-[clamp(1.85rem,4vw,3rem)] font-light tracking-tight text-ink">
            Nothing in the bag yet.
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-ink-soft">
            Browse assayed, patent-backed formulations — lot-documented and ready to ship.
          </p>
          <Link
            href="/products"
            className="mt-8 inline-flex items-center gap-2 bg-ink px-7 py-[1.125rem] text-[13px] font-medium text-paper transition-transform hover:-translate-y-0.5"
          >
            Open the shop
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>
      </div>
    );
  }

  const shipping = subtotalInr >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const total = subtotalInr + shipping;
  const toFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotalInr);
  const shipProgress = Math.min(100, (subtotalInr / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <>
      <header className="frame pb-5 pt-24 md:pb-6 md:pt-28">
        <Reveal>
          <p className="text-[12px] text-ink-soft">Confirm your formula</p>
        </Reveal>
        <h1 className="mt-1 max-w-[18ch] text-[clamp(1.75rem,3.5vw,2.75rem)] font-light leading-[1.08] tracking-tight text-ink">
          You&apos;re buying verified science.
        </h1>
        <Reveal delay={0.06}>
          <ol className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
            <li className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span className="relative grid h-3.5 w-3.5 place-items-center">
                <Circle className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
                <span className="absolute h-1.5 w-1.5 rounded-full bg-gold" />
              </span>
              Formula
            </li>
            <li className="h-px w-5 bg-ink/15" aria-hidden />
            <li className="inline-flex items-center gap-1.5 text-ink-mute">
              <Circle className="h-3.5 w-3.5 text-ink/25" strokeWidth={1.5} />
              Shipping
            </li>
            <li className="h-px w-5 bg-ink/15" aria-hidden />
            <li className="inline-flex items-center gap-1.5 text-ink-mute">
              <Circle className="h-3.5 w-3.5 text-ink/25" strokeWidth={1.5} />
              Payment
            </li>
          </ol>
        </Reveal>
      </header>

      {/* Products + checkout first — evidence is optional reading below */}
      <section className="frame pb-24 lg:pb-0">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-start lg:gap-12 xl:gap-16">
          {/* Lines only — keeps checkout in the first screenful */}
          <div className="border-t border-ink/10">
            {items.map((item) => (
              <CartLine
                key={item.productId}
                item={item}
                onRemove={() => remove(item.productId)}
                onQty={(q) => setQuantity(item.productId, q)}
              />
            ))}
          </div>

          <OrderPanel
            shipping={shipping}
            total={total}
            subtotalInr={subtotalInr}
            toFree={toFree}
            shipProgress={shipProgress}
            onCheckout={() => router.push("/checkout")}
          />

          {/* Included sits under products on desktop (same column) */}
          <div className="lg:col-start-1">
            <Reveal y={12}>
              <div className="border border-ink/10 bg-pearl/40 p-5 md:p-6">
                <h2 className="text-[15px] font-medium tracking-tight text-ink">
                  Included with this order
                </h2>
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {INCLUDED.map(({ label, icon: Icon }) => (
                    <li key={label} className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2} />
                      {label}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12px] text-ink-soft">{BATCH_LABEL} · Ships within ~7 days</p>
              </div>
            </Reveal>
            <div className="mt-5">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 border border-ink/20 px-5 py-2.5 text-[13px] text-ink transition-colors hover:border-ink hover:bg-paper"
              >
                Continue browsing
              </Link>
            </div>
          </div>
        </div>

        {/* Evidence after pay path — never blocks checkout */}
        <div className="mt-14 border-t border-ink/10 pt-10 md:mt-16 md:pt-12">
          <Reveal y={16}>
            <p className="text-[12px] text-ink-soft">Evidence</p>
            <h2 className="mt-1 text-[clamp(1.35rem,2.5vw,1.75rem)] font-light tracking-tight text-ink">
              Why researchers trust this formulation
            </h2>
            <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trustCards.map((card, i) => (
                <li
                  key={card.title}
                  className="border border-ink/10 bg-paper p-5 transition-shadow duration-300 hover:shadow-[0_12px_40px_-24px_rgba(17,17,17,0.35)]"
                >
                  <span className="font-mono text-[10px] text-gold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-[15px] font-medium text-ink">{card.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{card.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal y={14} delay={0.05}>
            <div className="mt-10">
              <h2 className="text-[15px] font-medium text-ink">Supporting research</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  {
                    href: "/patents",
                    title: "View supporting patents",
                    blurb: "Codes, jurisdictions, and summaries in the public registry."
                  },
                  {
                    href: "/blog",
                    title: "Read the research notebook",
                    blurb: "Notes, commentary, and reading from the lab."
                  },
                  {
                    href: "/contact",
                    title: "Request batch certificate",
                    blurb: "CoA / lot documents for your institutional file."
                  }
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-start justify-between gap-4 border border-ink/10 bg-pearl/30 px-5 py-4 transition-all duration-300 hover:border-ink/25 hover:bg-paper"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-ink">{link.title}</p>
                      <p className="mt-1 text-[12px] text-ink-soft">{link.blurb}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-mute transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-gold" />
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal y={12} delay={0.06}>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-y border-ink/10 py-6 text-[13px] text-ink-soft">
              <p>
                <span className="font-medium text-ink">SKUAST-K</span> research collaboration
              </p>
              <p>
                <span className="font-medium text-ink">{patentCount > 0 ? patentCount : "—"}</span>{" "}
                patents in portfolio
              </p>
              <p>
                <span className="font-medium text-ink">Assay</span> verified lots
              </p>
            </div>
          </Reveal>

          <Reveal y={12} delay={0.08}>
            <div className="mt-8 max-w-2xl">
              <h2 className="text-[15px] font-medium text-ink">Before you pay</h2>
              <CartFaq />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Always-reachable checkout on small screens */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-frame items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-soft">Total</p>
            <p className="text-[16px] font-medium tabular-nums text-ink">
              <Money value={total} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="shrink-0 bg-ink px-5 py-3.5 text-[13px] font-medium text-paper"
          >
            Checkout
          </button>
        </div>
      </div>
    </>
  );
}

function OrderPanel({
  shipping,
  total,
  subtotalInr,
  toFree,
  shipProgress,
  onCheckout
}: {
  shipping: number;
  total: number;
  subtotalInr: number;
  toFree: number;
  shipProgress: number;
  onCheckout: () => void;
}) {
  return (
    <aside className="h-fit self-start border border-ink/10 bg-[#f7f5f1] p-5 shadow-[0_12px_40px_-24px_rgba(17,17,17,0.35)] lg:sticky lg:top-24 lg:row-span-2 lg:p-6">
      <h2 className="text-[14px] font-medium text-ink">Order confirmation</h2>
      <p className="mt-1 text-[12px] text-ink-soft">
        Encrypted checkout · 30-second payment · Support available
      </p>

      <div className="mt-4 border border-ink/10 bg-paper/70 px-4 py-3">
        <p className="flex items-center gap-2 text-[13px] text-ink">
          <Truck className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
          Estimated dispatch within ~7 days
        </p>
        <p className="mt-1 pl-6 text-[12px] text-ink-soft">{BATCH_LABEL}</p>
      </div>

      <div className="mt-4">
        {toFree > 0 ? (
          <p className="text-[13px] text-ink">
            Spend <Money value={toFree} className="font-medium" /> more for free shipping
          </p>
        ) : (
          <p className="text-[13px] font-medium text-gold">Free shipping unlocked</p>
        )}
        <div className="mt-2 h-1 w-full overflow-hidden bg-ink/10">
          <motion.div
            className="h-full bg-gold"
            initial={false}
            animate={{ width: `${shipProgress}%` }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
          />
        </div>
      </div>

      <dl className="mt-5 space-y-2.5 border-t border-ink/10 pt-4 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Subtotal</dt>
          <dd className="text-ink">
            <Money value={subtotalInr} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Shipping</dt>
          <dd className="text-ink">{shipping === 0 ? "Free" : <Money value={shipping} />}</dd>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-3 text-[15px]">
          <dt className="font-medium text-ink">Total</dt>
          <dd className="font-medium text-ink">
            <Money value={total} />
          </dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-2 border-t border-ink/8 pt-4">
        {(
          [
            { label: "Secure Razorpay checkout", icon: Lock },
            { label: "GST invoice included", icon: FileCheck },
            { label: "Ships within ~7 days", icon: Truck },
            { label: "Lot documents on request", icon: Beaker }
          ] as const
        ).map(({ label, icon: Icon }) => (
          <li key={label} className="flex items-center gap-2.5 text-[12px] text-ink-soft">
            <Icon className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2} />
            {label}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCheckout}
        className="group relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden bg-ink py-[1.125rem] text-[13px] font-medium text-paper shadow-[0_8px_24px_-12px_rgba(17,17,17,0.5)] transition-[transform,box-shadow] duration-200 ease-expo hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-14px_rgba(17,17,17,0.5)]"
      >
        <span className="absolute inset-0 origin-left scale-x-0 bg-gold transition-transform duration-500 ease-expo group-hover:scale-x-100" />
        <span className="relative z-10 flex items-center gap-2">
          Proceed to secure checkout
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
      <p className="mt-2.5 text-center text-[12px] text-ink-soft">No hidden fees · Encrypted</p>
    </aside>
  );
}

function CartLine({
  item,
  onRemove,
  onQty
}: {
  item: CartItem;
  onRemove: () => void;
  onQty: (q: number) => void;
}) {
  const meta = [
    { label: "Patent-backed", icon: ShieldCheck },
    { label: item.sizeLabel, icon: Package },
    { label: "SKUAST-K", icon: Building2 },
    { label: "Lot verified", icon: FlaskConical },
    { label: "Ships ~7d", icon: Truck }
  ] as const;

  return (
    <article className="group grid gap-5 border-b border-ink/10 py-8 sm:grid-cols-[150px_1fr] sm:gap-8">
      <Link
        href={`/products/${item.slug}`}
        className="relative aspect-square w-full max-w-[150px] overflow-hidden bg-pearl sm:max-w-none"
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="150px"
            className="object-contain object-center p-3 transition-transform duration-700 ease-expo group-hover:scale-110"
          />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/products/${item.slug}`}
              className="text-lg font-light tracking-tight text-ink transition-colors hover:text-ink-soft md:text-xl"
            >
              {item.name}
            </Link>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
              {productStory(item.name)}
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {meta.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft"
                >
                  <Icon className="h-3 w-3 text-gold" strokeWidth={2} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="shrink-0 p-1.5 text-ink-mute transition-all duration-200 hover:scale-110 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center border border-ink/15 bg-pearl/50">
            <button
              type="button"
              onClick={() => onQty(item.quantity - 1)}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
              className="grid h-11 w-11 place-items-center text-ink transition-colors hover:bg-paper hover:text-gold disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={item.quantity}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="inline-block min-w-[2.5rem] text-center text-sm tabular-nums text-ink"
              >
                {item.quantity}
              </motion.span>
            </AnimatePresence>
            <button
              type="button"
              onClick={() => onQty(item.quantity + 1)}
              disabled={item.quantity >= item.maxQty}
              aria-label="Increase quantity"
              className="grid h-11 w-11 place-items-center text-ink transition-colors hover:bg-paper hover:text-gold disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <p className="text-xl font-light tracking-tight text-ink">
            <Money value={item.priceInr * item.quantity} />
          </p>
        </div>

        {item.maxQty > 0 && item.maxQty <= 8 ? (
          <p className="mt-3 text-[12px] text-gold">Limited — {item.maxQty} available in this lot</p>
        ) : null}
      </div>
    </article>
  );
}

function CartFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mt-4 border-t border-ink/10">
      {FAQ.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div key={faq.q} className="border-b border-ink/10">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="group flex w-full items-center justify-between gap-4 py-3.5 text-left"
            >
              <span className="text-[14px] font-light text-ink transition-colors group-hover:text-ink-soft">
                {faq.q}
              </span>
              <span
                className={cn(
                  "text-gold transition-transform duration-300 ease-expo",
                  isOpen && "rotate-45"
                )}
                aria-hidden
              >
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                  className="overflow-hidden"
                >
                  <p className="max-w-lg pb-3.5 text-[13px] leading-relaxed text-ink-soft">{faq.a}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
