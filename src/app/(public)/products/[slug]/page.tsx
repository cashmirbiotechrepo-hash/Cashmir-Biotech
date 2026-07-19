import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  FlaskConical,
  Leaf,
  Lock,
  MapPin,
  Package,
  ScrollText,
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

const PROCESS = [
  { step: "01", title: "Kashmiri flora", body: "Underutilised Himalayan botanicals selected for phytochemical density." },
  { step: "02", title: "Isolation", body: "Active fractions extracted and characterised — molecule first, format second." },
  { step: "03", title: "Verification", body: "Independent assay against specification before any lot reaches the storefront." },
  { step: "04", title: "Manufacture", body: "Finished under FSSAI-aligned protocols with batch documentation retained." },
  { step: "05", title: "Daily use", body: "Clear labeling. Traceable lots. Nutrition you can audit, not just taste." }
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

  const leadLabel = `Ships ~${product.leadTimeDays}d`;
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

  // Data-driven benefit cards — only what this product can actually claim.
  const benefits = [
    { icon: Leaf, title: product.category, body: product.shortBenefit },
    specsData?.specialIngredients
      ? { icon: FlaskConical, title: "Key ingredients", body: specsData.specialIngredients }
      : null,
    usageData?.suitableFor || otherData?.suitableFor
      ? { icon: Users, title: "Suitable for", body: usageData?.suitableFor ?? otherData!.suitableFor! }
      : null,
    {
      icon: ScrollText,
      title: patent ? `Patented · ${patent.patentCode}` : "Research model",
      body: patent
        ? patent.title
        : "Developed under a faculty–student innovation model with SKUAST-K — IP-aware from the first assay."
    }
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
    { id: "research", label: "Research" },
    { id: "benefits", label: "Benefits" },
    ...(hasUsageCards ? [{ id: "usage", label: "How to use" }] : []),
    { id: "story", label: "Process" },
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
    <div className="bg-paper pb-16 sm:pb-20">
      <ProductJsonLd product={product} available={availability.available} />
      {/* 58 / 42 hero — product left, buy panel supports */}
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

            <p className="mt-2.5 max-w-md text-[14px] leading-snug text-ink-mute sm:mt-3 sm:text-[15px]">
              {product.shortBenefit}
            </p>

            <div className="mt-4 sm:mt-5">
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

            <ul className="mt-5 flex gap-x-4 gap-y-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-7 sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-2 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
              {[
                { icon: Package, label: leadLabel },
                { icon: FlaskConical, label: "Lab tested" },
                { icon: Lock, label: "Secure pay" },
                { icon: MapPin, label: "Kashmir" }
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-mute">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.6} />
                  <span className="whitespace-nowrap">{label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 sm:mt-4">
              <ProductDetailAccordion sections={accordion} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Sticky section tabs + persistent price / Buy CTA */}
      <div className="mt-10 md:mt-12">
        <ProductSectionNav
          sections={navSections}
          priceLabel={priceLabel}
          available={availability.available}
          product={cartProduct}
        />
      </div>

      {/* Research first — the strongest differentiator, not a footnote */}
      <section id="research" className="frame scroll-mt-32 mt-10 md:mt-12">
        <Reveal>
          <div className="grid grid-cols-1 items-end gap-8 border border-ink/10 bg-ink px-6 py-10 text-paper md:grid-cols-12 md:px-10 md:py-12">
            <div className="md:col-span-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-soft">Intellectual property</p>
              <p className="mt-3 text-[clamp(2.5rem,6vw,4rem)] font-light leading-none tracking-tight">
                {patentCount > 0 ? patentCount : "—"}
              </p>
              <p className="mt-2 text-sm text-paper/60">
                {patentCount === 1 ? "patent in the portfolio" : "patents in the portfolio"}
              </p>
            </div>
            <div className="md:col-span-5">
              <p className="text-[15px] leading-relaxed text-paper/75">
                {patent
                  ? `This formula is linked to ${patent.patentCode}: ${patent.title}.`
                  : "Cashmir Biotech builds formulations inside an IP-aware pipeline with SKUAST-K — patents, assays, and claim language you can inspect."}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-paper/50">
                Certificates of analysis and batch documentation are retained for every released lot
                of {product.name} — ask after purchase.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:col-span-3 md:items-end">
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
        </Reveal>
      </section>

      {/* Key benefits — scannable cards, only claims this product carries */}
      <section id="benefits" className="frame scroll-mt-32 mt-10 md:mt-12">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Why this formula</p>
          <h2 className="mt-2 text-xl font-light tracking-tight text-ink md:text-2xl">Key benefits</h2>
        </Reveal>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-6 lg:grid-cols-4">
          {benefits.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={0.04 * i}>
              <div className="flex h-full flex-col border border-ink/10 px-5 py-5">
                <Icon className="h-5 w-5 text-gold" strokeWidth={1.5} />
                <h3 className="mt-3 text-[13px] font-medium tracking-tight text-ink">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <ProductHowToUse usage={product.usage} />

      {/* Origin story + process — one section, one rhythm change */}
      <section id="story" className="frame scroll-mt-32 mt-10 md:mt-12">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">From Kashmir</p>
          <p className="mt-3 max-w-3xl text-[clamp(1.35rem,3.2vw,2.1rem)] font-light leading-[1.15] tracking-tight text-ink">
            From forgotten medicinal plants. From years of research. From patented science — into
            daily nutrition.
          </p>
        </Reveal>

        <ol className="mt-8 border-t border-ink/10">
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

      <ProductSpecifications
        measurements={product.measurements}
        specs={product.specs}
        usage={product.usage}
        otherInfo={product.otherInfo}
        customFields={product.customFields ?? []}
      />

      {/* Biotech FAQs */}
      <section id="faq" className="frame scroll-mt-32 mt-10 md:mt-12">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Documentation</p>
          <h2 className="mt-2 max-w-lg text-xl font-light tracking-tight text-ink md:text-2xl">
            Ask like a scientist.
          </h2>
        </Reveal>
        <div className="mt-5 max-w-2xl md:mt-6">
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

      {/* Related products — keep shopping instead of dead-ending at the footer */}
      {related.length ? (
        <section id="related" className="frame scroll-mt-32 mt-12 md:mt-14">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Keep exploring</p>
                <h2 className="mt-2 text-xl font-light tracking-tight text-ink md:text-2xl">
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
          <div className="mt-5 grid grid-cols-2 gap-x-2.5 gap-y-5 md:mt-6 lg:grid-cols-4">
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
