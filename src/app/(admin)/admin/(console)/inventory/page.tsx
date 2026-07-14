import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { InventoryTable } from "@/components/admin/inventory-table";
import { AdminListToolbar } from "@/components/admin/list-toolbar";
import { AdminPagination } from "@/components/admin/pagination";
import { backfillInventory, listInventory } from "@/modules/admin/services/inventory.service";

export const metadata = { title: "Inventory" };

const PAGE_SIZE = 25;

export default async function AdminInventoryPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const lowOnly = sp.filter === "low";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  await backfillInventory();

  const { items, total } = await listInventory({ q, lowOnly, page, pageSize: PAGE_SIZE });

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Live stock levels driven by orders, with a full audit trail of every change. Deductions happen automatically when orders are paid; stock returns on cancel or refund."
      />

      <AdminListToolbar
        searchPlaceholder="Search product or SKU…"
        filters={[
          {
            name: "filter",
            value: lowOnly ? "low" : "",
            options: [
              { label: "All items", value: "" },
              { label: "Low stock only", value: "low" }
            ]
          }
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No tracked inventory"
          description={
            q || lowOnly
              ? "No items match your filters."
              : "Create a product with inventory tracking enabled and its stock will appear here."
          }
        />
      ) : (
        <>
          <InventoryTable rows={items} />
          {!lowOnly ? <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} /> : null}
        </>
      )}
    </>
  );
}
