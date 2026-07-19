"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getPricingDisplay, sellingInrFromPaise } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ProductPrice } from "@/components/shop/product-price";

export type CustomFieldDraft = { label: string; value: string };

type JsonRecord = Record<string, string>;

export function FieldGrid({
  fields,
  values,
  onChange
}: {
  fields: Array<{ key: string; label: string; multiline?: boolean }>;
  values: JsonRecord;
  onChange: (next: JsonRecord) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className={cn("space-y-1.5", field.multiline && "sm:col-span-2")}>
          <Label htmlFor={`pi-${field.key}`} className="text-xs text-muted-foreground">
            {field.label}
          </Label>
          {field.multiline ? (
            <Textarea
              id={`pi-${field.key}`}
              rows={3}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
            />
          ) : (
            <Input
              id={`pi-${field.key}`}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function PricingPreview({ mrpInr, sellingInr }: { mrpInr: number; sellingInr: number }) {
  const display = getPricingDisplay(mrpInr, sellingInr);
  return (
    <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Storefront preview
      </p>
      <ProductPrice mrpInr={display.mrpInr} sellingInr={display.sellingInr} />
      {!display.hasDiscount ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No discount badge — selling price equals MRP.
        </p>
      ) : null}
    </div>
  );
}

export function CustomFieldsEditor({
  fields,
  onChange
}: {
  fields: CustomFieldDraft[];
  onChange: (next: CustomFieldDraft[]) => void;
}) {
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">No custom fields yet.</p>
      ) : null}
      {fields.map((field, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-md border border-border/70 p-2.5 sm:grid-cols-[1fr_1fr_auto]"
        >
          <Input
            placeholder="Field name"
            value={field.label}
            onChange={(e) => {
              const next = [...fields];
              next[index] = { ...next[index], label: e.target.value };
              onChange(next);
            }}
          />
          <Input
            placeholder="Value"
            value={field.value}
            onChange={(e) => {
              const next = [...fields];
              next[index] = { ...next[index], value: e.target.value };
              onChange(next);
            }}
          />
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" onClick={() => move(index, -1)} aria-label="Move up">
              <ArrowUp className="size-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => move(index, 1)} aria-label="Move down">
              <ArrowDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onChange(fields.filter((_, i) => i !== index))}
              aria-label="Remove field"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...fields, { label: "", value: "" }])}
      >
        <Plus className="size-3.5" />
        Add field
      </Button>
    </div>
  );
}

export function useProductInfoState(product?: {
  pricePaise?: number | null;
  mrpInr?: number;
  measurements?: unknown;
  specs?: unknown;
  usage?: unknown;
  otherInfo?: unknown;
  customFields?: Array<{ label: string; value: string }>;
} | null) {
  const asRecord = (value: unknown): JsonRecord => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: JsonRecord = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  };

  const [mrpInr, setMrpInr] = useState(product?.mrpInr ?? 499);
  const [sellingInr, setSellingInr] = useState(
    product
      ? sellingInrFromPaise(product.pricePaise, product.mrpInr ?? 0)
      : 499
  );
  const [measurements, setMeasurements] = useState<JsonRecord>(() => asRecord(product?.measurements));
  const [specs, setSpecs] = useState<JsonRecord>(() => asRecord(product?.specs));
  const [usage, setUsage] = useState<JsonRecord>(() => asRecord(product?.usage));
  const [otherInfo, setOtherInfo] = useState<JsonRecord>(() => asRecord(product?.otherInfo));
  const [customFields, setCustomFields] = useState<CustomFieldDraft[]>(
    () => product?.customFields?.map((f) => ({ label: f.label, value: f.value })) ?? []
  );

  useEffect(() => {
    setMrpInr(product?.mrpInr ?? 499);
    setSellingInr(
      product ? sellingInrFromPaise(product.pricePaise, product.mrpInr ?? 0) : 499
    );
    setMeasurements(asRecord(product?.measurements));
    setSpecs(asRecord(product?.specs));
    setUsage(asRecord(product?.usage));
    setOtherInfo(asRecord(product?.otherInfo));
    setCustomFields(product?.customFields?.map((f) => ({ label: f.label, value: f.value })) ?? []);
  }, [product]);

  const hiddenJson = useMemo(
    () => ({
      measurementsJson: JSON.stringify(measurements),
      specsJson: JSON.stringify(specs),
      usageJson: JSON.stringify(usage),
      otherInfoJson: JSON.stringify(otherInfo),
      customFieldsJson: JSON.stringify(
        customFields.filter((f) => f.label.trim() && f.value.trim())
      )
    }),
    [measurements, specs, usage, otherInfo, customFields]
  );

  return {
    mrpInr,
    setMrpInr,
    sellingInr,
    setSellingInr,
    measurements,
    setMeasurements,
    specs,
    setSpecs,
    usage,
    setUsage,
    otherInfo,
    setOtherInfo,
    customFields,
    setCustomFields,
    hiddenJson,
  };
}

export const MEASUREMENT_FIELDS = [
  { key: "unitCount", label: "Unit count" },
  { key: "itemWeight", label: "Item weight" },
  { key: "netQuantity", label: "Net quantity" },
  { key: "itemDimensions", label: "Item dimensions" }
];

export const SPEC_FIELDS = [
  { key: "brand", label: "Brand" },
  { key: "genericName", label: "Generic name" },
  { key: "flavor", label: "Flavor" },
  { key: "form", label: "Form" },
  { key: "dietType", label: "Diet type" },
  { key: "ageRange", label: "Age range" },
  { key: "specialIngredients", label: "Special ingredients", multiline: true },
  { key: "materialFeatures", label: "Material features" },
  { key: "countryOfOrigin", label: "Country of origin" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "manufacturerAddress", label: "Manufacturer address", multiline: true },
  { key: "packer", label: "Packer" }
];

export const USAGE_FIELDS = [
  { key: "directions", label: "Directions", multiline: true },
  { key: "recommendedUsage", label: "Recommended usage", multiline: true },
  { key: "storageInstructions", label: "Storage instructions", multiline: true },
  { key: "safetyInformation", label: "Safety information", multiline: true }
];

export const OTHER_INFO_FIELDS = [
  { key: "shelfLife", label: "Shelf life" },
  { key: "batchNumber", label: "Batch number" },
  { key: "fssaiNumber", label: "FSSAI number" },
  { key: "barcode", label: "Barcode" },
  { key: "certifications", label: "Certifications", multiline: true },
  { key: "suitableFor", label: "Suitable for" },
  { key: "allergens", label: "Allergens", multiline: true },
  { key: "servingSize", label: "Serving size" },
  { key: "servingsPerContainer", label: "Servings per container" }
];
