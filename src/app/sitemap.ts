import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cashmirbiotech.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/products", "/patents", "/team"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7
  }));
}
