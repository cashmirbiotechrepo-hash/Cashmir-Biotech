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

export const productUpdateSchema = z.object({
  id: z.string().min(1),
  name: nonEmpty.max(500),
  shortBenefit: nonEmpty.max(500),
  description: z.string().max(50000),
  mrpInr: z.coerce.number().int().min(0).max(100_000_000),
  sizeLabel: nonEmpty.max(200),
  imageUrl: safeUrl
});

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
