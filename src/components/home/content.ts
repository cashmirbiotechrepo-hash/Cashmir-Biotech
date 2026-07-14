import type { PublicHomeData } from "@/modules/cms/services/content.service";

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  shortBenefit: string;
  description?: string;
  category: string;
  sizeLabel: string;
  mrpInr: number;
  imageUrl?: string;
  featured?: boolean;
};

export type PatentCard = {
  id: string;
  patentCode: string;
  title: string;
  summary: string;
  status: string;
  jurisdiction: string;
  year: string;
  imageUrl?: string;
};

export type HomeContent = {
  hero: {
    eyebrow: string;
    title: string;
    accentWords: number[];
    description: string;
    ctaPrimaryText: string;
    ctaPrimaryHref: string;
    ctaSecondaryText: string;
    ctaSecondaryHref: string;
  };
  mission: string;
  marquee: string[];
  pipeline: { index: string; title: string; body: string }[];
  metrics: { value: number; decimals?: number; suffix?: string; label: string; note: string }[];
  products: ProductCard[];
  patents: PatentCard[];
  faqs: { q: string; a: string }[];
};

const DEFAULT_MARQUEE = [
  "Phyto-active Extraction",
  "LC-MS Verification",
  "Himalayan Biodiversity",
  "Precision Formulation",
  "Patent Registry",
  "Clinical Labeling"
];

const DEFAULT_PIPELINE = [
  {
    index: "01",
    title: "Alpine Source Selection",
    body: "Underutilised Kashmiri flora is identified with SKUAST-K and hand-selected at altitude for phytochemical density."
  },
  {
    index: "02",
    title: "Cold-Chain Phyto Isolation",
    body: "Actives are isolated under temperature-controlled, low-oxygen conditions to protect molecular integrity end to end."
  },
  {
    index: "03",
    title: "Independent Assay",
    body: "Every batch is verified by LC-MS at independent facilities — composition measured, documented, and traceable."
  },
  {
    index: "04",
    title: "Clinical-Ready Nutrition",
    body: "Formulations are finished to GMP discipline with full batch records and clinical-grade labeling."
  }
];

const DEFAULT_METRICS = [
  { value: 99.7, decimals: 1, suffix: "%", label: "Purity Protocol", note: "Verified compound purity across production batches." },
  { value: 14, suffix: "+", label: "IP Assets", note: "Patents, designs, trademarks, and international filings." },
  { value: 1, label: "Research Partner", note: "SKUAST-K faculty–student innovation model." }
];

const DEFAULT_FAQS = [
  {
    q: "What makes Cashmir Biotech different?",
    a: "We engineer nutrition from underutilised Himalayan biodiversity, isolating patented phyto-actives under a clinical, evidence-led discipline rather than commodity supplement practice."
  },
  {
    q: "How is quality verified?",
    a: "Every batch passes independent LC-MS assay and is produced under GMP discipline with complete batch records and traceability from alpine source to finished product."
  },
  {
    q: "Who do you work with?",
    a: "We operate a faculty–student innovation model in partnership with SKUAST-K, translating peer-reviewed research into registered, patent-backed formulations."
  }
];

const FALLBACK_PRODUCTS: ProductCard[] = [
  {
    id: "magic-food-taxo",
    slug: "magic-food-taxo-250g",
    name: "Magic Food TaxO",
    shortBenefit: "Nutritional herbal compound for daily vitality",
    category: "Functional Food",
    sizeLabel: "250 g",
    mrpInr: 350,
    imageUrl: "/products/magic-food-taxo.png",
    featured: true
  }
];

const FALLBACK_PATENTS: PatentCard[] = [
  {
    id: "in-499495",
    patentCode: "IN-499495",
    title: "Nutritional Herbal Compound Extract and Its Method of Preparation",
    summary:
      "Novel herbal nutritional formulation and extraction methodology for nutraceutical compounds with improved nutritional value.",
    status: "Granted",
    jurisdiction: "India",
    year: "2024",
    imageUrl: "/patents/magic-food-extract.png"
  }
];

export function buildHomeContent(data: PublicHomeData | null): HomeContent {
  const settings = data?.settings ?? null;

  const products: ProductCard[] =
    data?.products && data.products.length > 0
      ? data.products.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          shortBenefit: p.shortBenefit,
          description: p.description,
          category: p.category,
          sizeLabel: p.sizeLabel,
          mrpInr: p.mrpInr,
          imageUrl: p.imageUrl,
          featured: p.featured
        }))
      : FALLBACK_PRODUCTS;

  const patents: PatentCard[] =
    data?.patents && data.patents.length > 0
      ? data.patents.map((p) => ({
          id: p.id,
          patentCode: p.patentCode,
          title: p.title,
          summary: p.summary,
          status: p.status,
          jurisdiction: p.jurisdiction,
          year: new Date(p.publishedAt).getFullYear().toString(),
          imageUrl: p.imageUrl || undefined
        }))
      : FALLBACK_PATENTS;

  const title = settings?.heroTitle ?? "Precision biology from the Himalaya.";
  const words = title.split(" ");
  const accentWords = words.length > 1 ? [words.length - 1] : [];

  return {
    hero: {
      eyebrow: settings?.heroSubtitle ?? "Clinical-precision biotechnology",
      title,
      accentWords,
      description:
        settings?.heroDescription ??
        "We isolate patented phyto-actives from underutilised Himalayan biodiversity — engineered under clinical discipline into nutrition the body can trust.",
      ctaPrimaryText: settings?.ctaPrimaryText ?? "Explore Catalog",
      ctaPrimaryHref: settings?.ctaPrimaryHref ?? "/products",
      ctaSecondaryText: settings?.ctaSecondaryText ?? "View Patents",
      ctaSecondaryHref: settings?.ctaSecondaryHref ?? "/patents"
    },
    mission:
      settings?.missionStatement ??
      "We didn't set out to make another supplement. We set out to translate the Himalaya's rarest molecules into evidence-led human health.",
    marquee: DEFAULT_MARQUEE,
    pipeline: DEFAULT_PIPELINE,
    metrics: DEFAULT_METRICS,
    products,
    patents,
    faqs: DEFAULT_FAQS
  };
}
