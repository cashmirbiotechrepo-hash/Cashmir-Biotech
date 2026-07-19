import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200)
});

/** Allows only site-relative paths or http(s) URLs — blocks javascript:, data:, and protocol-relative //. */
const safeUrl = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (v) => {
      if (v.startsWith("//")) return false;
      if (v.startsWith("/")) {
        return /^\/[A-Za-z0-9._~/-]*$/.test(v) && !v.includes("//");
      }
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Must be a site-relative path or an http(s) URL" }
  );

export const homepageSettingsSchema = z.object({
  heroTitle: nonEmpty.max(500),
  heroSubtitle: z.string().trim().max(500),
  heroDescription: nonEmpty.max(20000),
  ctaPrimaryText: nonEmpty.max(200),
  ctaPrimaryHref: safeUrl,
  ctaSecondaryText: nonEmpty.max(200),
  ctaSecondaryHref: safeUrl,
  missionStatement: nonEmpty.max(20000)
});

export const measurementsSchema = z
  .object({
    unitCount: z.string().trim().max(200).optional(),
    itemWeight: z.string().trim().max(200).optional(),
    netQuantity: z.string().trim().max(200).optional(),
    itemDimensions: z.string().trim().max(200).optional()
  })
  .partial();

export const specsSchema = z
  .object({
    flavor: z.string().trim().max(200).optional(),
    specialIngredients: z.string().trim().max(2000).optional(),
    dietType: z.string().trim().max(200).optional(),
    form: z.string().trim().max(200).optional(),
    ageRange: z.string().trim().max(200).optional(),
    materialFeatures: z.string().trim().max(500).optional(),
    countryOfOrigin: z.string().trim().max(200).optional(),
    manufacturer: z.string().trim().max(300).optional(),
    manufacturerAddress: z.string().trim().max(1000).optional(),
    packer: z.string().trim().max(300).optional(),
    brand: z.string().trim().max(200).optional(),
    genericName: z.string().trim().max(200).optional()
  })
  .partial();

export const usageSchema = z
  .object({
    directions: z.string().trim().max(5000).optional(),
    recommendedUsage: z.string().trim().max(5000).optional(),
    storageInstructions: z.string().trim().max(5000).optional(),
    safetyInformation: z.string().trim().max(5000).optional()
  })
  .partial();

export const otherInfoSchema = z
  .object({
    shelfLife: z.string().trim().max(200).optional(),
    batchNumber: z.string().trim().max(200).optional(),
    fssaiNumber: z.string().trim().max(200).optional(),
    barcode: z.string().trim().max(200).optional(),
    certifications: z.string().trim().max(1000).optional(),
    suitableFor: z.string().trim().max(500).optional(),
    allergens: z.string().trim().max(1000).optional(),
    servingSize: z.string().trim().max(200).optional(),
    servingsPerContainer: z.string().trim().max(200).optional()
  })
  .partial();

export const customFieldSchema = z.object({
  label: z.string().trim().min(1, "Field name is required").max(120),
  value: z.string().trim().min(1, "Value is required").max(2000),
  sortOrder: z.coerce.number().int().min(0).default(0)
});

const optionalPositiveInt = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : undefined;
}, z.number().int().min(1).max(100).optional());

export const productPricingFieldsSchema = z.object({
  mrpInr: z.coerce.number().int().positive("MRP must be greater than zero").max(100_000_000),
  sellingPriceInr: z.coerce
    .number()
    .int()
    .positive("Selling price must be greater than zero")
    .max(100_000_000),
  currency: z.string().trim().min(1).max(8).default("INR"),
  minOrderQty: z.coerce.number().int().min(1).max(100).default(1),
  maxOrderQty: optionalPositiveInt
});

export const productUpdateSchema = z
  .object({
    id: z.string().min(1),
    name: nonEmpty.max(500),
    shortBenefit: nonEmpty.max(500),
    description: z.string().max(50000),
    sizeLabel: nonEmpty.max(200),
    imageUrl: safeUrl,
    measurements: measurementsSchema.optional(),
    specs: specsSchema.optional(),
    usage: usageSchema.optional(),
    otherInfo: otherInfoSchema.optional(),
    customFields: z.array(customFieldSchema).max(40).optional()
  })
  .merge(productPricingFieldsSchema)
  .superRefine((data, ctx) => {
    if (data.sellingPriceInr > data.mrpInr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selling price cannot exceed MRP",
        path: ["sellingPriceInr"]
      });
    }
    if (data.maxOrderQty != null && data.maxOrderQty < data.minOrderQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max order quantity must be ≥ min order quantity",
        path: ["maxOrderQty"]
      });
    }
  });

export type ProductMeasurements = z.infer<typeof measurementsSchema>;
export type ProductSpecs = z.infer<typeof specsSchema>;
export type ProductUsage = z.infer<typeof usageSchema>;
export type ProductOtherInfo = z.infer<typeof otherInfoSchema>;
export type ProductCustomFieldInput = z.infer<typeof customFieldSchema>;

export const patentUpdateSchema = z.object({
  id: z.string().min(1),
  title: nonEmpty.max(1000),
  summary: z.string().max(50000),
  status: nonEmpty.max(200)
});

export const teamMemberUpdateSchema = z.object({
  id: z.string().min(1),
  fullName: nonEmpty.max(200),
  role: nonEmpty.max(200),
  bio: z.string().max(50000),
  avatarUrl: safeUrl
});
