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
  Microscope,
  Package,
  ScrollText
} from "lucide-react";
import {
  getActiveProductBySlug,
  getProductAvailability,
  listPatents
} from "@/modules/cms/services/content.service";
import { getShippingRates } from "@/modules/shop/services/order.service";
import { ProductGallery } from "@/components/ui/product-gallery";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductDetailAccordion } from "@/components/shop/product-detail-accordion";
import { ProductInfoSections } from "@/components/shop/product-info-sections";
import { ProductJsonLd } from "@/components/shop/product-json-ld";
import { ProductPrice } from "@/components/shop/product-price";
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
  const [product, patents, rates] = await Promise.all([
    getActiveProductBySlug(slug),
    listPatents().catch(() => []),
    getShippingRates().catch(() => ({
      flatShippingInr: 60,
      freeShippingThresholdInr: 999,
      freeThresholdCents: 99900,
      flatShippingCents: 6000
    }))
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

  const leadLabel = `Ships ~${product.leadTimeDays}d`;

  const accordion = [
    {
      id: "research",
      title: "Research & patents",
      body: patent
        ? `${patent.title}\n${patent.patentCode} · ${patent.jurisdiction} · ${patent.lifecycleStatus}\n\n${patent.summary}`
        : `Cashmir Biotech formulations are developed under a faculty–student innovation model with SKUAST-K.\n\nAsk our team for the certificate of analysis and patent bibliography for ${product.name}.`
    },
    {
      id: "details",
      title: "Full description",
      body: product.description
    },
    {
      id: "origin",
      title: "Origin & process",
      body: `${product.name} is finished from botanical material sourced in the Kashmir Himalayas.\n\nEach lot is isolated for phytochemical density, documented through manufacturing, and verified by independent assay before release.`
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
      {/* 58 / 42 hero — product left, buy panel supports */}
      <section className="frame scroll-mt-28 pt-[4.75rem] md:scroll-mt-32 md:pt-20 lg:pt-24">
        <div className="grid grid-cols-1 items-start gap-4 md:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
          <Reveal y={24} className="w-full lg:sticky lg:top-28 lg:self-start">
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
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                sizeLabel: product.sizeLabel,
                priceInr: sellingInr,
                imageUrl: product.imageUrl
              }}
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
              <ProductDetailAccordion sections={accordion} defaultOpenId="research" />
            </div>
          </Reveal>
        </div>
      </section>

      <ProductInfoSections
        measurements={product.measurements}
        specs={product.specs}
        usage={product.usage}
        otherInfo={product.otherInfo}
        customFields={product.customFields ?? []}
      />

      {/* Emotional Kashmir beat — large / tiny rhythm */}
      <section className="frame scroll-mt-28 mt-14 md:mt-16 lg:mt-20">
        <div className="hairline-x mb-8 h-px w-full md:mb-10" />
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">From Kashmir</p>
          <p className="mt-4 max-w-3xl text-[clamp(1.5rem,3.8vw,2.65rem)] font-light leading-[1.12] tracking-tight text-ink">
            From forgotten medicinal plants. From years of research. From patented science — into daily nutrition.
          </p>
        </Reveal>
      </section>

      {/* Process timeline — not paragraphs */}
      <section className="frame scroll-mt-28 mt-14 md:mt-16">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Why this formula</p>
          <h2 className="mt-2 max-w-xl text-xl font-light tracking-tight text-ink md:text-2xl">
            Molecule-first, end to end.
          </h2>
        </Reveal>

        <ol className="mt-8 border-t border-ink/10">
          {PROCESS.map((item, i) => (
            <Reveal key={item.step} delay={0.04 * i}>
              <li className="grid grid-cols-[3rem_1fr] gap-4 border-b border-ink/10 py-5 md:grid-cols-[4rem_12rem_1fr] md:gap-8 md:py-6">
                <span className="font-mono text-[11px] text-gold">{item.step}</span>
                <span className="text-[15px] font-medium tracking-tight text-ink md:text-base">{item.title}</span>
                <span className="col-span-2 text-sm leading-relaxed text-ink-mute md:col-span-1">{item.body}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Patent band — signature differentiator */}
      <section className="frame scroll-mt-28 mt-14 md:mt-16">
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

      {/* Differentiated credibility tiles */}
      <section className="frame scroll-mt-28 mt-10 md:mt-14">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          <Reveal>
            <div className="flex h-full flex-col bg-pearl/80 px-6 py-8">
              <Microscope className="h-7 w-7 text-gold" strokeWidth={1.25} />
              <h3 className="mt-6 text-lg font-light tracking-tight text-ink">Assayed every lot</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-mute">
                Independent verification against specification — before anything ships.
              </p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Lab protocol</p>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="flex h-full flex-col border border-ink/10 px-6 py-8">
              <Leaf className="h-7 w-7 text-gold" strokeWidth={1.25} />
              <h3 className="mt-6 text-lg font-light tracking-tight text-ink">Kashmiri biodiversity</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-mute">
                Altitude flora chosen for chemistry — not commodity fillers dressed as wellness.
              </p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Provenance</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex h-full flex-col bg-ink px-6 py-8 text-paper">
              <ScrollText className="h-7 w-7 text-gold-soft" strokeWidth={1.25} />
              <h3 className="mt-6 text-lg font-light tracking-tight">
                {patent ? patent.patentCode : "Research model"}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-paper/65">
                {patent
                  ? patent.title
                  : "Faculty–student innovation with SKUAST-K — IP-aware from the first assay."}
              </p>
              <Link
                href={patent ? "/patents" : "/team"}
                className="mt-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-gold-soft"
              >
                {patent ? "View patent" : "Meet the board"} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Biotech FAQs */}
      <section className="frame scroll-mt-28 mt-14 pb-4 md:mt-16">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Documentation</p>
          <h2 className="mt-2 max-w-lg text-xl font-light tracking-tight text-ink md:text-2xl">
            Ask like a scientist.
          </h2>
        </Reveal>
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
    </div>
  );
}
