import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CategoriesTable } from "@/components/admin/categories-table";

export const metadata = { title: "Product Categories" };

export default async function AdminCategoriesPage() {
  const [categories, productGroups] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.product.groupBy({
      by: ["category"],
      _count: { _all: true }
    })
  ]);

  const countMap = Object.fromEntries(
    productGroups.map((g) => [g.category, g._count._all])
  );

  const rows = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder,
    active: c.active,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    productCount: countMap[c.name] ?? 0
  }));

  return (
    <>
      <AdminPageHeader
        title="Product Categories"
        description="Taxonomy for shop filters. Product labels stay denormalized on each SKU."
      />
      <CategoriesTable categories={rows} />
    </>
  );
}
