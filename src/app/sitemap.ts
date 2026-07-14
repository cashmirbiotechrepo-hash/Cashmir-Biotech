import type { MetadataRoute } from "next";
import { LIVE_TOOLS } from "@/components/tools/catalog";
import { listActiveProductSlugs, listPublishedPosts } from "@/modules/cms/services/content.service";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cashmirbiotech.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths = ["", "/products", "/tools", "/patents", "/blog", "/team", "/about", "/contact"];
  const toolPaths = LIVE_TOOLS.map((t) => `/tools/${t.slug}`);

  let postEntries: MetadataRoute.Sitemap = [];
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const [posts, products] = await Promise.all([listPublishedPosts(), listActiveProductSlugs()]);
    postEntries = posts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6
    }));
    productEntries = products.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }));
  } catch {
    // sitemap should still render core paths even if the DB is unreachable
  }

  return [
    ...[...staticPaths, ...toolPaths].map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7
    })),
    ...productEntries,
    ...postEntries
  ];
}
