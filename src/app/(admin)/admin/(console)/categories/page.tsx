import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  saveCategoryAction,
  syncCategoriesFromProductsAction
} from "@/app/(admin)/admin/(console)/category-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Categories" };

async function saveCategory(formData: FormData) {
  "use server";
  await saveCategoryAction(formData);
}

async function syncCategories() {
  "use server";
  await syncCategoriesFromProductsAction();
}

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="Taxonomy for shop filters. Product.category strings remain the storefront labels."
        actions={
          <form action={syncCategories}>
            <Button type="submit" variant="outline" size="sm">
              Sync from products
            </Button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet — sync from products or add one.</p>
            ) : (
              <ul className="divide-y">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {c.name}{" "}
                      <span className="font-mono text-[10px] text-muted-foreground">{c.slug}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{c.active ? "active" : "hidden"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add / update</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveCategory} className="space-y-3">
              <div>
                <Label htmlFor="cat-name">Name</Label>
                <Input id="cat-name" name="name" required />
              </div>
              <div>
                <Label htmlFor="cat-sort">Sort order</Label>
                <Input id="cat-sort" name="sortOrder" type="number" defaultValue={0} />
              </div>
              <Button type="submit">Save category</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
