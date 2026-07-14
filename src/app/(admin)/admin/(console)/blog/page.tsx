import Link from "next/link";
import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BlogModule } from "@/components/admin/blog-module";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Blog" };

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function AdminBlogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 20;
  const q = params.q?.trim();

  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
          { excerpt: { contains: q, mode: "insensitive" as const } }
        ]
      }
    : {};

  const [posts, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.blogPost.count({ where })
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const buildPageUrl = (nextPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("page", String(nextPage));
    return `/admin/blog?${sp.toString()}`;
  };

  return (
    <>
      <AdminPageHeader title="Blog" description="Draft and publish research updates and company news." />

      <Card className="mb-4">
        <CardContent className="p-4">
          <form className="flex flex-wrap gap-2" action="/admin/blog" method="get">
            <Input name="q" placeholder="Search posts…" defaultValue={q ?? ""} className="max-w-sm" />
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <BlogModule posts={posts} />

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({total} posts)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={buildPageUrl(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={buildPageUrl(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
