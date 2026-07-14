import "server-only";
import { db } from "@/lib/db";

/** Count storefront references to a media URL before delete. */
export async function countMediaUrlReferences(url: string): Promise<number> {
  const [products, patents, blogPosts, team] = await Promise.all([
    db.product.count({ where: { imageUrl: url } }),
    db.patent.count({ where: { imageUrl: url } }),
    db.blogPost.count({ where: { coverImageUrl: url } }),
    db.teamMember.count({ where: { avatarUrl: url } })
  ]);
  return products + patents + blogPosts + team;
}
