"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInventoryLotAction } from "@/app/(admin)/admin/(console)/inventory-lot-actions";

type LotRow = {
  id: string;
  lotCode: string;
  quantityOnHand: number;
  expiresAt: string | null;
  active: boolean;
};

export function LotManager({ productId, lots }: { productId: string; lots: LotRow[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Lots / batches</h3>
      <ul className="divide-y text-sm">
        {lots.length === 0 ? (
          <li className="py-2 text-muted-foreground">No lots yet — restock creates provenance rows.</li>
        ) : (
          lots.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2">
              <span>
                <span className="font-mono text-xs">{l.lotCode}</span>
                {!l.active ? <span className="ml-2 text-xs text-muted-foreground">inactive</span> : null}
                {l.expiresAt ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    exp {new Date(l.expiresAt).toLocaleDateString("en-IN")}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums">{l.quantityOnHand}</span>
            </li>
          ))
        )}
      </ul>

      <form
        className="grid gap-3 border-t pt-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            await createInventoryLotAction(fd);
            e.currentTarget.reset();
          });
        }}
      >
        <input type="hidden" name="productId" value={productId} />
        <div>
          <Label htmlFor="lotCode">Lot code</Label>
          <Input id="lotCode" name="lotCode" required placeholder="CB-2026-A1" />
        </div>
        <div>
          <Label htmlFor="qty">Quantity</Label>
          <Input id="qty" name="quantity" type="number" min={1} required defaultValue={10} />
        </div>
        <div>
          <Label htmlFor="exp">Expiry (optional)</Label>
          <Input id="exp" name="expiresAt" type="date" />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" placeholder="Manufacturing lot" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Saving…" : "Add / restock lot"}
          </Button>
        </div>
      </form>
    </div>
  );
}
