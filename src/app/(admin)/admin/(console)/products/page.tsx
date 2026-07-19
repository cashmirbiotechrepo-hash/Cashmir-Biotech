import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductsTable } from "@/components/admin/products-table";
import { AdminListToolbar } from "@/components/admin/list-toolbar";
import { AdminPagination } from "@/components/admin/pagination";

export const metadata = { title: "Products" };

const PAGE_SIZE = 25;

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where: Prisma.ProductWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(category ? { category } : {}),
    ...(status === "active" ? { active: true } : status === "hidden" ? { active: false } : {}),
    ...(status === "featured" ? { featured: true } : {})
  };

  const [products, total, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        inventory: {
          select: {
            quantityOnHand: true,
            quantityReserved: true,
            lowStockThreshold: true
          }
        },
        customFields: { orderBy: { sortOrder: "asc" } }
      }
    }),
    db.product.count({ where }),
    db.product.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } })
  ]);

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Catalog workspace — keep the list open, edit details beside it, adjust stock inline."
      />

      <AdminListToolbar
        searchPlaceholder="Search name, SKU…"
        filters={[
          {
            name: "category",
            value: category,
            options: [
              { label: "All categories", value: "" },
              ...categories.map((c) => ({ label: c.category, value: c.category }))
            ]
          },
          {
            name: "status",
            value: status,
            options: [
              { label: "All", value: "" },
              { label: "Active", value: "active" },
              { label: "Hidden", value: "hidden" },
              { label: "Featured", value: "featured" }
            ]
          }
        ]}
      />

      <ProductsTable products={products} />
      <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
