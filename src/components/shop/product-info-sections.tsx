import type { LucideIcon } from "lucide-react";
import { CalendarClock, Pill, ShieldAlert, Thermometer } from "lucide-react";
import { ProductDetailAccordion } from "@/components/shop/product-detail-accordion";
import { Reveal } from "@/components/ui/reveal";

type CustomField = { label: string; value: string };

const LABELS: Record<string, string> = {
  unitCount: "Unit count",
  itemWeight: "Item weight",
  netQuantity: "Net quantity",
  itemDimensions: "Item dimensions",
  flavor: "Flavor",
  specialIngredients: "Special ingredients",
  dietType: "Diet type",
  form: "Form",
  ageRange: "Age range",
  materialFeatures: "Material features",
  countryOfOrigin: "Country of origin",
  manufacturer: "Manufacturer",
  manufacturerAddress: "Manufacturer address",
  packer: "Packer",
  brand: "Brand",
  genericName: "Generic name",
  directions: "Directions",
  recommendedUsage: "Recommended usage",
  storageInstructions: "Storage instructions",
  safetyInformation: "Safety information",
  shelfLife: "Shelf life",
  batchNumber: "Batch number",
  fssaiNumber: "FSSAI number",
  barcode: "Barcode",
  certifications: "Certifications",
  suitableFor: "Suitable for",
  allergens: "Allergens",
  servingSize: "Serving size",
  servingsPerContainer: "Servings per container"
};

/** Usage keys that earn a card in "How to use"; everything else stays in specifications. */
const USAGE_CARDS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "directions", label: "Directions", icon: Pill },
  { key: "recommendedUsage", label: "When to take", icon: CalendarClock },
  { key: "storageInstructions", label: "Storage", icon: Thermometer },
  { key: "safetyInformation", label: "Safety", icon: ShieldAlert }
];

export function asRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

function SpecTable({ data }: { data: Record<string, string> }) {
  return (
    <dl className="divide-y divide-ink/8">
      {Object.entries(data).map(([key, value]) => (
        <div
          key={key}
          className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-6"
        >
          <dt className="text-[12px] text-ink-mute">{LABELS[key] ?? key}</dt>
          <dd className="text-[13px] leading-relaxed text-ink whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** How-to-use as scannable icon cards, not a label/value table. */
export function ProductHowToUse({ usage }: { usage: unknown }) {
  const data = asRecord(usage);
  if (!data) return null;

  const cards = USAGE_CARDS.filter(({ key }) => data[key]);
  if (!cards.length) return null;

  return (
    <section id="usage" className="frame scroll-mt-32 mt-16 md:mt-24">
      <Reveal>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Daily protocol</p>
        <h2 className="mt-2.5 text-[1.5rem] font-light leading-[1.12] tracking-tight text-ink md:text-[1.9rem]">
          How to use
        </h2>
      </Reveal>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-8 lg:grid-cols-4">
        {cards.map(({ key, label, icon: Icon }, i) => (
          <Reveal key={key} delay={0.04 * i}>
            <div className="flex h-full flex-col bg-pearl/70 px-5 py-5">
              <Icon className="h-5 w-5 text-gold" strokeWidth={1.5} />
              <h3 className="mt-3 text-[13px] font-medium tracking-tight text-ink">{label}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute whitespace-pre-wrap">
                {data[key]}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * Regulatory and technical attributes behind progressive disclosure — present
 * for anyone who wants them, invisible while deciding.
 */
export function ProductSpecifications({
  measurements,
  specs,
  usage,
  otherInfo,
  customFields
}: {
  measurements: unknown;
  specs: unknown;
  usage: unknown;
  otherInfo: unknown;
  customFields: CustomField[];
}) {
  const usageData = asRecord(usage);
  const usedInCards = new Set(USAGE_CARDS.map((c) => c.key));
  const usageLeftovers = usageData
    ? Object.fromEntries(Object.entries(usageData).filter(([k]) => !usedInCards.has(k)))
    : null;
  const custom = customFields.filter((f) => f.label.trim() && f.value.trim());

  const candidates: Array<{ id: string; title: string; data: Record<string, string> | null }> = [
    { id: "measurements", title: "Size & measurements", data: asRecord(measurements) },
    { id: "specs", title: "Manufacturer & regulatory", data: asRecord(specs) },
    {
      id: "usage-details",
      title: "Usage details",
      data: usageLeftovers && Object.keys(usageLeftovers).length ? usageLeftovers : null
    },
    { id: "other", title: "Additional attributes", data: asRecord(otherInfo) },
    {
      id: "custom",
      title: "More details",
      data: custom.length ? Object.fromEntries(custom.map((f) => [f.label, f.value])) : null
    }
  ];
  const groups = candidates.flatMap((g) => (g.data ? [{ ...g, data: g.data }] : []));

  if (!groups.length) return null;

  return (
    <section id="specifications" className="frame scroll-mt-32 mt-16 md:mt-24">
      <Reveal>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">For the record</p>
        <h2 className="mt-2.5 text-[1.15rem] font-light tracking-tight text-ink md:text-[1.35rem]">
          Specifications
        </h2>
        <p className="mt-2 text-[13px] text-ink-mute">
          Full technical, manufacturer, and regulatory information — collapsed so it never gets in
          the way of deciding.
        </p>
      </Reveal>
      <div className="mt-5 max-w-3xl md:mt-6">
        <ProductDetailAccordion
          sections={groups.map((g) => ({
            id: g.id,
            title: g.title,
            body: <SpecTable data={g.data} />
          }))}
        />
      </div>
    </section>
  );
}
