"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

export function AdminPagination({
  page,
  pageSize,
  total
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  const buildUrl = (nextPage: number) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("page", String(nextPage));
    return `${pathname}?${sp.toString()}`;
  };

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={buildUrl(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={buildUrl(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
