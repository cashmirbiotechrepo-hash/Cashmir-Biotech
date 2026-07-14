import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { listInventoryTransactions } from "@/modules/admin/services/inventory.service";
import { listLotsForProduct } from "@/modules/admin/services/inventory-lots.service";
import { CoaManager } from "@/components/admin/coa-manager";
import { LotManager } from "@/components/admin/lot-manager";

export const metadata = { title: "Inventory history" };

const CHANGE_LABELS: Record<string, string> = {
  initial_stock: "Initial stock",
  order_placed: "Reserved (order)",
  order_confirmed: "Deducted (order paid)",
  order_cancelled: "Returned (cancelled)",
  order_returned: "Returned (refund)",
  manual_adjustment: "Manual adjustment",
  restock: "Restock",
  damaged: "Damaged / loss"
};

export default async function InventoryHistoryPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const [product, inventory, transactions, certificates, lots] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, select: { name: true, sku: true } }),
    db.inventory.findUnique({ where: { productId } }),
    listInventoryTransactions(productId, 200),
    db.certificateOfAnalysis.findMany({
      where: { productId },
      orderBy: { issuedAt: "desc" },
      take: 50
    }),
    listLotsForProduct(productId)
  ]);
  if (!product) notFound();

  const available = inventory ? inventory.quantityOnHand - inventory.quantityReserved : 0;

  return (
    <>
      <AdminPageHeader
        title={product.name}
        description={`SKU ${product.sku || "—"} · inventory transaction log`}
        actions={
          <Link href="/admin/inventory" className="text-sm text-primary hover:underline">
            ← Back to inventory
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">On hand</p>
            <p className="mt-1 text-2xl font-light tabular-nums">{inventory?.quantityOnHand ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Reserved</p>
            <p className="mt-1 text-2xl font-light tabular-nums">{inventory?.quantityReserved ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Available</p>
            <p className="mt-1 text-2xl font-light tabular-nums">{available}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        <LotManager
          productId={productId}
          lots={lots.map((l) => ({
            id: l.id,
            lotCode: l.lotCode,
            quantityOnHand: l.quantityOnHand,
            expiresAt: l.expiresAt?.toISOString() ?? null,
            active: l.active
          }))}
        />
        <CoaManager
          productId={productId}
          certificates={certificates.map((c) => ({
            id: c.id,
            lotCode: c.lotCode,
            title: c.title,
            fileUrl: c.fileUrl,
            issuedAt: c.issuedAt.toISOString(),
            active: c.active
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No transactions recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CHANGE_LABELS[t.changeType] ?? t.changeType}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${t.quantityChange < 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {t.quantityChange > 0 ? `+${t.quantityChange}` : t.quantityChange}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{t.quantityBefore}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantityAfter}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.referenceType}
                      {t.referenceId ? ` · ${t.referenceId.slice(0, 8)}` : ""}
                      {t.note ? <span className="block">{t.note}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.createdBy ?? "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
