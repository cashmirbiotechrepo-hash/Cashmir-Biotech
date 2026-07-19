import { hasContent } from "@/lib/product-sections";

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

function asRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

function InfoTable({ title, data }: { title: string; data: Record<string, string> }) {
  return (
    <section className="border border-ink/10 bg-paper px-5 py-5 sm:px-6">
      <h3 className="text-[15px] font-medium tracking-tight text-ink">{title}</h3>
      <dl className="mt-4 divide-y divide-ink/8">
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
    </section>
  );
}

export function ProductInfoSections({
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
  const measurementData = asRecord(measurements);
  const specsData = asRecord(specs);
  const usageData = asRecord(usage);
  const otherData = asRecord(otherInfo);
  const custom = customFields.filter((f) => f.label.trim() && f.value.trim());

  const hasAny =
    hasContent(measurementData) ||
    hasContent(specsData) ||
    hasContent(usageData) ||
    hasContent(otherData) ||
    custom.length > 0;

  if (!hasAny) return null;

  return (
    <section className="frame scroll-mt-28 mt-14 md:mt-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Product information</p>
      <h2 className="mt-2 max-w-xl text-xl font-light tracking-tight text-ink md:text-2xl">
        Details that matter.
      </h2>
      <div className="mt-6 space-y-4 md:mt-8">
        {measurementData ? <InfoTable title="Measurements" data={measurementData} /> : null}
        {specsData ? <InfoTable title="Features & specs" data={specsData} /> : null}
        {usageData ? <InfoTable title="Usage instructions" data={usageData} /> : null}
        {otherData ? <InfoTable title="Additional details" data={otherData} /> : null}
        {custom.length > 0 ? (
          <InfoTable
            title="Custom details"
            data={Object.fromEntries(custom.map((f) => [f.label, f.value]))}
          />
        ) : null}
      </div>
    </section>
  );
}
