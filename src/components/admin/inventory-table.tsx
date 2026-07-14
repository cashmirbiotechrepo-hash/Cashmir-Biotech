"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { adjustInventoryAction } from "@/app/(admin)/admin/(console)/inventory-actions";
import { AdminField, FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { InventoryOverviewRow } from "@/modules/admin/services/inventory.service";

function AdjustForm({ row, onDone }: { row: InventoryOverviewRow; onDone: () => void }) {
  const { pending, state, onSubmit } = useAdminForm(adjustInventoryAction, { onSuccess: onDone });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="productId" value={row.productId} />
      <div className="space-y-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Action</label>
        <select name="mode" defaultValue="restock" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
          <option value="restock">Add stock (restock)</option>
          <option value="damaged">Remove (damaged/loss)</option>
          <option value="set">Set exact on-hand</option>
        </select>
      </div>
      <AdminField label="Quantity" name="quantity" type="number" defaultValue={0} />
      <div className="sm:col-span-2">
        <AdminField label="Note (optional)" name="note" required={false} placeholder="e.g. Restocked from supplier X" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-4">
        <SaveButton pending={pending} label="Apply adjustment" />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function InventoryTable({ rows }: { rows: InventoryOverviewRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const open = openId === row.id;
              return (
                <Fragment key={row.id}>
                  <TableRow className={cn(open && "bg-muted/40")}>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="font-mono text-xs">{row.sku || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.quantityOnHand}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.quantityReserved}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", row.isLow && "text-destructive")}>
                      {row.quantityAvailable}
                    </TableCell>
                    <TableCell>
                      {row.isLow ? (
                        <Badge variant="destructive">Low</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : row.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          {open ? "Close" : "Adjust"}
                        </button>
                        <Link
                          href={`/admin/inventory/${row.productId}`}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          History
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20 p-4">
                        <AdjustForm row={row} onDone={() => setOpenId(null)} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
