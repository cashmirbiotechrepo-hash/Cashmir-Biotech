import Link from "next/link";
import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MediaLibrary } from "@/components/admin/media-library";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Media" };

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function AdminMediaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 24;
  const q = params.q?.trim();

  const where = q
    ? {
        OR: [
          { url: { contains: q, mode: "insensitive" as const } },
          { altText: { contains: q, mode: "insensitive" as const } },
          { uploadedBy: { contains: q, mode: "insensitive" as const } }
        ]
      }
    : {};

  const [assets, total] = await Promise.all([
    db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.mediaAsset.count({ where })
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const buildPageUrl = (nextPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("page", String(nextPage));
    return `/admin/media?${sp.toString()}`;
  };

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description="Shared images for products, blog posts, and patents."
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <form className="flex flex-wrap gap-2" action="/admin/media" method="get">
            <Input name="q" placeholder="Search by URL, alt text, uploader…" defaultValue={q ?? ""} className="max-w-sm" />
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <MediaLibrary assets={assets} />

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({total} assets)
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
