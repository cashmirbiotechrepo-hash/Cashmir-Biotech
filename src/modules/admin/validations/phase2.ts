import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const optionalText = z.string().trim().optional().or(z.literal(""));

export const patentFullSchema = z.object({
  id: z.string().optional(),
  title: nonEmpty.max(1000),
  summary: z.string().max(50000),
  status: nonEmpty.max(200),
  lifecycleStatus: z.enum(["pending", "granted", "expired"]),
  patentCode: nonEmpty.max(100),
  applicationNumber: z.string().trim().max(100).optional(),
  jurisdiction: nonEmpty.max(200),
  country: z.string().trim().max(200).optional(),
  imageUrl: z.string().trim().max(2000),
  documentUrl: z.string().trim().max(2000).optional(),
  inventors: z.string().trim().max(5000).optional(),
  filedAt: z.string().optional(),
  grantedAt: z.string().optional(),
  publishedAt: z.string().optional(),
  linkedProductIds: z.string().optional()
});

export const contactSchema = z.object({
  id: z.string().optional(),
  name: nonEmpty.max(200),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  company: optionalText,
  phone: optionalText,
  type: z.enum(["lead", "customer", "partner"]),
  notes: z.string().max(20000).optional()
});

export const dealSchema = z.object({
  id: z.string().optional(),
  contactId: z.string().min(1),
  title: nonEmpty.max(500),
  stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]),
  valueCents: z.coerce.number().int().min(0),
  expectedCloseAt: z.string().optional()
});

export const couponSchema = z.object({
  id: z.string().optional(),
  code: nonEmpty.max(50).transform((v) => v.toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().int().min(1),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  expiresAt: z.string().optional(),
  active: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
    .transform((v) => v === "on" || v === "true")
});

export const expenseSchema = z.object({
  title: nonEmpty.max(500),
  category: nonEmpty.max(200),
  amountCents: z.coerce.number().int().min(1),
  gstCents: z.coerce.number().int().min(0).default(0),
  vendor: optionalText,
  notes: z.string().max(10000).optional(),
  incurredAt: z.string().optional()
});

export const invoiceFromOrderSchema = z.object({
  orderId: z.string().min(1),
  gstin: z.string().trim().max(20).optional(),
  placeOfSupply: z.string().trim().max(100).default("Jammu & Kashmir")
});

export const campaignSchema = z.object({
  id: z.string().optional(),
  name: nonEmpty.max(200),
  subject: nonEmpty.max(500),
  body: nonEmpty.max(50000)
});
