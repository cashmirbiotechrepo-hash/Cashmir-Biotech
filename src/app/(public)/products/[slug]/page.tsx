import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FlaskConical,
  Leaf,
  Minus,
  Users
} from "lucide-react";
import {
  getActiveProductBySlug,
  getProductAvailability,
  listActiveProducts,
  listPatents
} from "@/modules/cms/services/content.service";
import { getShippingRates } from "@/modules/shop/services/order.service";
import { ProductGallery } from "@/components/ui/product-gallery";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductDetailAccordion } from "@/components/shop/product-detail-accordion";
import {
  ProductHowToUse,
  ProductSpecifications,
  asRecord
} from "@/components/shop/product-info-sections";
import { ProductJsonLd } from "@/components/shop/product-json-ld";
import { ProductPrice } from "@/components/shop/product-price";
import { ProductSectionNav } from "@/components/shop/product-section-nav";
import { ShopCountUp } from "@/components/shop/shop-count-up";
import { ShopProductCard } from "@/components/shop/shop-product-card";
import { Reveal } from "@/components/ui/reveal";
import { sellingInrFromPaise } from "@/lib/pricing";
import { getStockStatus } from "@/lib/pricing";

export const revalidate = 300;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.shortBenefit || product.description.slice(0, 155),
    openGraph: {
      title: product.name,
      description: product.shortBenefit,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined
    }
  };
}

/* Spacing system: sections sit on a 64 / 96px rhythm; scroll margin clears both sticky bars. */
const SECTION = "frame scroll-mt-40 mt-16 md:mt-24";

function SectionHeader({
  eyebrow,
  title,
  lede
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <Reveal>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{eyebrow}</p>
      <h2 className="mt-2.5 max-w-2xl text-[1.5rem] font-light leading-[1.12] tracking-tight text-ink md:text-[1.9rem]">
        {title}
      </h2>
      {lede ? <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-ink-mute">{lede}</p> : null}
    </Reveal>
  );
}

const PROCESS = [
  { step: "01", title: "Kashmiri flora", body: "Underutilised Himalayan botanicals selected for phytochemical density." },
  { step: "02", title: "Isolation", body: "Active fractions extracted and characterised — molecule first, format second." },
  { step: "03", title: "Verification", body: "Independent assay against specification before any lot reaches the storefront." },
  { step: "04", title: "Manufacture", body: "Finished under FSSAI-aligned protocols with batch documentation retained." },
  { step: "05", title: "Daily use", body: "Clear labeling. Traceable lots. Nutrition you can audit, not just taste." }
];

const COMPARISON = [
  {
    label: "Formulation source",
    generic: "Commodity blends, white-labelled",
    ours: "Characterised Himalayan botanical fractions"
  },
  {
    label: "Verification",
    generic: "Label claims only",
    ours: "Independent assay on every release lot"
  },
  {
    label: "Intellectual property",
    generic: "None",
    ours: "Patent-linked formulas with SKUAST-K"
  },
  {
    label: "Origin",
    generic: "Untraceable supply chains",
    ours: "Single origin — Kashmir Himalayas"
  },
  {
    label: "Documentation",
    generic: "Unavailable",
    ours: "CoA and batch records on request"
  }
];

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, patents, rates, allProducts] = await Promise.all([
    getActiveProductBySlug(slug),
    listPatents().catch(() => []),
    getShippingRates().catch(() => ({
      flatShippingInr: 60,
      freeShippingThresholdInr: 999,
      freeThresholdCents: 99900,
      flatShippingCents: 6000
    })),
    listActiveProducts().catch(() => [])
  ]);
  if (!product) notFound();

  const availability = await getProductAvailability(product);
  const inStock = availability.available > 0;
  const patent = product.patent;
  const sellingInr = sellingInrFromPaise(product.pricePaise, product.mrpInr);
  const priceLabel = inr.format(sellingInr);
  const patentCount = patents.length;
  const stockStatus = getStockStatus(availability.available, product.lowStockThreshold);
  const low = stockStatus === "low_stock";
  const related = allProducts.filter((p) => p.id !== product.id).slice(0, 4);

  const cartProduct = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    sizeLabel: product.sizeLabel,
    priceInr: sellingInr,
    imageUrl: product.imageUrl
  };

  const specsData = asRecord(product.specs);
  const usageData = asRecord(product.usage);
  const otherData = asRecord(product.otherInfo);

  // Scannable hero checklist — every line comes from this product's own data.
  const heroChecklist = [
    product.shortBenefit,
    product.sizeLabel,
    patent ? `Patented — ${patent.patentCode}` : "IP-aware formulation",
    "Developed with SKUAST-K",
    "Independently assayed lots",
    "Made in Kashmir"
  ].filter(Boolean);

  // Benefit cards carry only product-specific claims; institutional proof
  // lives in the research section so nothing repeats.
  const benefits = [
    { icon: Leaf, title: product.category, body: product.shortBenefit },
    specsData?.specialIngredients
      ? { icon: FlaskConical, title: "Key ingredients", body: specsData.specialIngredients }
      : null,
    usageData?.suitableFor || otherData?.suitableFor
      ? { icon: Users, title: "Suitable for", body: usageData?.suitableFor ?? otherData!.suitableFor! }
      : null
  ].filter((b): b is NonNullable<typeof b> => Boolean(b));

  const hasUsageCards = Boolean(
    usageData &&
      ["directions", "recommendedUsage", "storageInstructions", "safetyInformation"].some(
        (k) => usageData[k]
      )
  );
  const hasSpecs = Boolean(
    asRecord(product.measurements) ||
      specsData ||
      usageData ||
      otherData ||
      (product.customFields ?? []).some((f) => f.label.trim() && f.value.trim())
  );

  const navSections = [
    ...(benefits.length ? [{ id: "benefits", label: "Benefits" }] : []),
    { id: "research", label: "Research" },
    { id: "compare", label: "Compare" },
    { id: "process", label: "Process" },
    ...(hasUsageCards ? [{ id: "usage", label: "How to use" }] : []),
    ...(hasSpecs ? [{ id: "specifications", label: "Specs" }] : []),
    { id: "faq", label: "FAQ" },
    ...(related.length ? [{ id: "related", label: "More" }] : [])
  ];

  const accordion = [
    {
      id: "details",
      title: "Full description",
      body: product.description
    },
    {
      id: "shipping",
      title: "Shipping & support",
      body: `Ships in approximately ${product.leadTimeDays} day${product.leadTimeDays === 1 ? "" : "s"} after payment.\n\nFree shipping on orders of ${inr.format(rates.freeShippingThresholdInr)}+ within India. Secure payments via Razorpay. For batch documents, reply to your order confirmation.`
    }
  ];

  return (
    <div className="bg-paper pb-16 sm:pb-24">
      <ProductJsonLd product={product} available={availability.available} />

      {/* ——— 1 · What is this? Hero: image + scannable claims + buy ——— */}
      <section className="frame scroll-mt-28 pt-[4.75rem] md:scroll-mt-32 md:pt-20 lg:pt-24">
        <div className="grid grid-cols-1 items-start gap-4 md:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
          <Reveal y={24} className="w-full lg:sticky lg:top-32 lg:self-start">
            <div className="relative">
              <Link
                href="/products"
                className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-paper/90 px-3 py-1.5 text-[11px] text-ink shadow-sm backdrop-blur-md md:hidden"
              >
                <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
                Shop
              </Link>
              <ProductGallery
                variant="hero"
                name={product.name}
                category={product.category}
                imageUrl={product.imageUrl}
                images={product.images}
              />
            </div>
          </Reveal>

          <Reveal delay={0.05} y={20} className="flex flex-col lg:pt-1">
            <Link
              href="/products"
              className="mb-4 hidden w-fit items-center gap-2 text-[12px] text-ink-mute transition-colors hover:text-ink md:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              Shop
            </Link>

            {product.featured || !inStock ? (
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold sm:mb-2">
                {!inStock ? "Sold out" : "Featured"}
              </p>
            ) : (
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint sm:mb-2">
                {product.category}
              </p>
            )}

            <h1 className="text-[clamp(1.75rem,6.5vw,2.75rem)] font-light leading-[1.05] tracking-tight text-ink">
              {product.name}
            </h1>

            {/* Scan, don't read: the paragraph is one click away in the accordion. */}
            <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 sm:mt-5 sm:grid-cols-2">
              {heroChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px] leading-snug text-ink">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.25} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 sm:mt-6">
              <ProductPrice
                mrpInr={product.mrpInr}
                sellingInr={sellingInr}
                sizeLabel={product.sizeLabel}
              />
              {low ? (
                <p className="mt-1.5 text-[12px] text-gold">Only {availability.available} left</p>
              ) : null}
              {stockStatus === "out_of_stock" ? (
                <p className="mt-1.5 text-[12px] text-[#CC0C39]">Out of stock</p>
              ) : null}
            </div>

            <AddToCart
              className="mt-5 sm:mt-6"
              available={availability.available}
              priceLabel={priceLabel}
              product={cartProduct}
            />

            <p className="mt-4 text-[12px] text-ink-mute">
              Ships in ~{product.leadTimeDays}d · Free shipping over{" "}
              {inr.format(rates.freeShippingThresholdInr)} · Secure Razorpay checkout
            </p>

            <div className="mt-4 sm:mt-5">
              <ProductDetailAccordion sections={accordion} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Sticky section nav + persistent price / Buy — follows the whole page */}
      <div className="mt-12 md:mt-16">
        <ProductSectionNav
          sections={navSections}
          priceLabel={priceLabel}
          available={availability.available}
          product={cartProduct}
        />
      </div>

      {/* ——— 2 · Why should I care? High-emphasis benefit band ——— */}
      {benefits.length ? (
        <section id="benefits" className={SECTION}>
          <SectionHeader eyebrow="Why this formula" title="What it does for you" />
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-8 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={0.05 * i}>
                <div className="flex h-full flex-col bg-pearl/70 px-6 py-7">
                  <Icon className="h-6 w-6 text-gold" strokeWidth={1.4} />
                  <h3 className="mt-4 text-[14px] font-medium tracking-tight text-ink">{title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-mute">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* ——— 3 · Who developed it? Research showcase — the signature beat ——— */}
      <section id="research" className={SECTION}>
        <Reveal>
          <div className="grid grid-cols-1 gap-10 border border-ink/10 bg-ink px-6 py-12 text-paper md:grid-cols-12 md:gap-8 md:px-10 md:py-16">
            <div className="md:col-span-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-soft">
                The science behind it
              </p>
              <p className="mt-5 text-[clamp(4rem,10vw,7rem)] font-light leading-none tracking-tight">
                <ShopCountUp value={patentCount > 0 ? patentCount : 0} />
              </p>
              <p className="mt-3 max-w-[16rem] text-[15px] leading-snug text-paper/70">
                {patentCount === 1 ? "patent" : "patents"} in the Cashmir Biotech portfolio,
                developed with SKUAST-K
              </p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                <Link
                  href="/patents"
                  className="inline-flex items-center gap-2 text-[13px] text-paper underline-offset-4 hover:underline"
                >
                  Patent index <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/team"
                  className="inline-flex items-center gap-2 text-[13px] text-paper/55 underline-offset-4 hover:text-paper hover:underline"
                >
                  Research board <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="md:col-span-7">
              {patent ? (
                /* The linked patent, presented as the document it is. */
                <div className="flex h-full flex-col border border-paper/15 bg-paper/[0.03] px-6 py-7 md:px-8 md:py-8">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-[11px] tracking-[0.14em] text-gold-soft">
                      {patent.patentCode}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/45">
                      {patent.jurisdiction} · {patent.lifecycleStatus}
                    </p>
                  </div>
                  <h3 className="mt-4 text-lg font-light leading-snug tracking-tight md:text-xl">
                    {patent.title}
                  </h3>
                  <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-paper/65 line-clamp-4">
                    {patent.summary}
                  </p>
                  <p className="mt-5 border-t border-paper/10 pt-4 text-[12px] text-paper/50">
                    This formula is manufactured under the claims of this patent. Certificates of
                    analysis are retained for every released lot.
                  </p>
                </div>
              ) : (
                <div className="flex h-full flex-col justify-center border border-paper/15 bg-paper/[0.03] px-6 py-7 md:px-8">
                  <h3 className="text-lg font-light leading-snug tracking-tight md:text-xl">
                    Faculty–student innovation with SKUAST-K
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-paper/65">
                    Every Cashmir Biotech formulation moves through an IP-aware pipeline — botanical
                    screening, fraction characterisation, and independent assay — before it is
                    released. Batch documentation is retained for every lot of {product.name}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ——— 4 · Why is it different? Comparison ——— */}
      <section id="compare" className={SECTION}>
        <SectionHeader
          eyebrow="The difference"
          title="Against a generic supplement"
          lede="Same shelf, different discipline. Here is what changes when a formula comes out of a research pipeline instead of a catalogue."
        />
        <div className="mt-6 overflow-hidden border border-ink/10 md:mt-8">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] border-b border-ink/10 bg-pearl/60 sm:grid">
            <p className="px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint" />
            <p className="px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
              Generic supplements
            </p>
            <p className="px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
              Cashmir Biotech
            </p>
          </div>
          {COMPARISON.map((row, i) => (
            <Reveal key={row.label} delay={0.03 * i}>
              <div className="grid grid-cols-1 border-b border-ink/8 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
                <p className="px-5 pt-4 text-[12px] font-medium tracking-tight text-ink sm:py-4">
                  {row.label}
                </p>
                <p className="flex items-start gap-2 px-5 pt-2 text-[13px] leading-snug text-ink-faint sm:py-4">
                  <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {row.generic}
                </p>
                <p className="flex items-start gap-2 px-5 pb-4 pt-2 text-[13px] leading-snug text-ink sm:py-4">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
                  {row.ours}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ——— 5 · How is it made? Quiet process timeline ——— */}
      <section id="process" className={SECTION}>
        <SectionHeader
          eyebrow="From Kashmir"
          title="From forgotten medicinal plants into daily nutrition"
        />
        <ol className="mt-6 border-t border-ink/10 md:mt-8">
          {PROCESS.map((item, i) => (
            <Reveal key={item.step} delay={0.04 * i}>
              <li className="grid grid-cols-[3rem_1fr] gap-4 border-b border-ink/10 py-4 md:grid-cols-[4rem_12rem_1fr] md:gap-8 md:py-5">
                <span className="font-mono text-[11px] text-gold">{item.step}</span>
                <span className="text-[15px] font-medium tracking-tight text-ink md:text-base">{item.title}</span>
                <span className="col-span-2 text-sm leading-relaxed text-ink-mute md:col-span-1">{item.body}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ——— 6 · Directions ——— */}
      <ProductHowToUse usage={product.usage} />

      {/* ——— 7 · Specifications, collapsed and quiet ——— */}
      <ProductSpecifications
        measurements={product.measurements}
        specs={product.specs}
        usage={product.usage}
        otherInfo={product.otherInfo}
        customFields={product.customFields ?? []}
      />

      {/* ——— 8 · FAQ ——— */}
      <section id="faq" className={SECTION}>
        <SectionHeader eyebrow="Documentation" title="Ask like a scientist" />
        <div className="mt-6 max-w-2xl md:mt-8">
          <ProductDetailAccordion
            sections={[
              {
                id: "assay",
                title: "Can I request assay / CoA reports?",
                body: `Yes. After purchase — or on wholesale enquiry — ask for the certificate of analysis for your lot of ${product.name}. We retain batch documentation for released SKUs.`
              },
              {
                id: "batch",
                title: "How do I verify batch authenticity?",
                body: "Use the lot code on the pack when you email support. We match it against manufacturing records and the assay retained for that release."
              },
              {
                id: "ip",
                title: "Where are the patents listed?",
                body: patent
                  ? `This product is linked to ${patent.patentCode}. Browse the full index on the Patents page, including jurisdiction and lifecycle status.`
                  : "Browse the Patents page for the live index. Linked formulations surface their patent code on the product research panel."
              },
              {
                id: "how",
                title: "How should I take it?",
                body: `Follow the serving guidance on the ${product.sizeLabel} pack. For use alongside medication, consult your clinician.`
              }
            ]}
          />
        </div>
      </section>

      {/* ——— 9 · Keep shopping ——— */}
      {related.length ? (
        <section id="related" className={SECTION}>
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Keep exploring</p>
                <h2 className="mt-2.5 text-[1.5rem] font-light leading-[1.12] tracking-tight text-ink md:text-[1.9rem]">
                  More from the lab
                </h2>
              </div>
              <Link
                href="/products"
                className="hidden items-center gap-1.5 text-[13px] text-ink-mute transition-colors hover:text-ink sm:inline-flex"
              >
                All formulas <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>
          <div className="mt-6 grid grid-cols-2 gap-x-2.5 gap-y-5 md:mt-8 lg:grid-cols-4">
            {related.map((p, i) => (
              <Reveal key={p.id} delay={0.04 * i}>
                <ShopProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
