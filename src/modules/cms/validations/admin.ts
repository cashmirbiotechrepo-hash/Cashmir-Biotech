import { z } from "zod";

const nonEmpty = z.string().trim();

export const homepageSettingsSchema = z.object({
  heroTitle: nonEmpty.max(500),
  heroDescription: nonEmpty.max(20000),
  missionStatement: nonEmpty.max(20000)
});

export const productUpdateSchema = z.object({
  id: z.string().min(1),
  name: nonEmpty.max(500),
  shortBenefit: nonEmpty.max(500),
  description: z.string().max(50000),
  mrpInr: z.coerce.number().int().min(0).max(100_000_000),
  sizeLabel: nonEmpty.max(200),
  imageUrl: z.string().min(1).max(2000)
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
  avatarUrl: z.string().min(1).max(2000)
});
