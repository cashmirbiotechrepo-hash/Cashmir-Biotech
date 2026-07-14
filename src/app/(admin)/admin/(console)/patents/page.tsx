import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PatentsModule } from "@/components/admin/patents-module";
import { listPatentsFull } from "@/modules/admin/services/phase2.service";

export const metadata = { title: "Patents" };

export default async function AdminPatentsPage() {
  const [patents, products] = await Promise.all([
    listPatentsFull(),
    db.product.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <>
      <AdminPageHeader
        title="Patent registry"
        description="Full IP records — filing dates, inventors, lifecycle status, and linked catalog products."
      />
      <PatentsModule patents={patents} products={products} />
    </>
  );
}
