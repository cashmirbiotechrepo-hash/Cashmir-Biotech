import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export type LotAllocationResult = {
  lotId: string;
  lotCode: string;
  quantity: number;
};

/**
 * Ensure lot rows cover aggregate on-hand (LEGACY bridge), then FEFO-draw `quantity`
 * and write OrderItemLotAllocation + OrderItem.lotCodes.
 * Call BEFORE decreasing Inventory.quantityOnHand.
 */
export async function allocateLotsForFulfillment(
  input: {
    productId: string;
    orderItemId: string;
    quantity: number;
  },
  client: Tx | typeof db = db
): Promise<LotAllocationResult[]> {
  if (input.quantity <= 0) return [];

  const inventory = await client.inventory.findUnique({ where: { productId: input.productId } });
  if (!inventory) return [];

  const existing = await client.inventoryLot.findMany({ where: { inventoryId: inventory.id, active: true } });
  const nonLegacySum = existing.filter((l) => l.lotCode !== "LEGACY").reduce((s, l) => s + l.quantityOnHand, 0);
  const legacyRow = existing.find((l) => l.lotCode === "LEGACY");
  const covered = nonLegacySum + (legacyRow?.quantityOnHand ?? 0);
  if (covered < inventory.quantityOnHand) {
    const gap = inventory.quantityOnHand - covered;
    await client.inventoryLot.upsert({
      where: { inventoryId_lotCode: { inventoryId: inventory.id, lotCode: "LEGACY" } },
      create: {
        inventoryId: inventory.id,
        lotCode: "LEGACY",
        quantityOnHand: gap,
        notes: "Auto-bridged unallocated on-hand stock"
      },
      update: { quantityOnHand: { increment: gap }, active: true }
    });
  }

  const lots = await client.inventoryLot.findMany({
    where: { inventoryId: inventory.id, active: true, quantityOnHand: { gt: 0 } },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }]
  });

  let remaining = input.quantity;
  const allocated: LotAllocationResult[] = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantityOnHand, remaining);
    if (take <= 0) continue;

    await client.inventoryLot.update({
      where: { id: lot.id },
      data: { quantityOnHand: { decrement: take } }
    });
    await client.orderItemLotAllocation.create({
      data: {
        orderItemId: input.orderItemId,
        lotId: lot.id,
        quantity: take
      }
    });
    allocated.push({ lotId: lot.id, lotCode: lot.lotCode, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient lot quantity for product ${input.productId} (short ${remaining}).`);
  }

  const codes = allocated.map((a) => (a.quantity > 1 ? `${a.lotCode}×${a.quantity}` : a.lotCode)).join(", ");
  await client.orderItem.update({
    where: { id: input.orderItemId },
    data: { lotCodes: codes }
  });

  return allocated;
}

/** Restore lot quantities when an order is cancelled/refunded (best-effort by allocation rows). */
export async function restoreLotsForOrderItem(orderItemId: string, client: Tx | typeof db = db) {
  const allocations = await client.orderItemLotAllocation.findMany({ where: { orderItemId } });
  for (const a of allocations) {
    await client.inventoryLot.update({
      where: { id: a.lotId },
      data: { quantityOnHand: { increment: a.quantity } }
    });
  }
  if (allocations.length) {
    await client.orderItemLotAllocation.deleteMany({ where: { orderItemId } });
    await client.orderItem.update({ where: { id: orderItemId }, data: { lotCodes: "" } });
  }
}

export async function createOrRestockLot(input: {
  productId: string;
  lotCode: string;
  quantity: number;
  expiresAt?: Date | null;
  manufacturedAt?: Date | null;
  notes?: string;
  /** When true, also bump Inventory.quantityOnHand and Product.stockQty. */
  bumpAggregate?: boolean;
}) {
  const inventory = await db.inventory.findUnique({ where: { productId: input.productId } });
  if (!inventory) throw new Error("Inventory row missing for product.");

  const code = input.lotCode.trim().toUpperCase();
  const qty = Math.max(0, input.quantity);

  const lot = await db.$transaction(async (tx) => {
    const updated = await tx.inventoryLot.upsert({
      where: { inventoryId_lotCode: { inventoryId: inventory.id, lotCode: code } },
      create: {
        inventoryId: inventory.id,
        lotCode: code,
        quantityOnHand: qty,
        expiresAt: input.expiresAt ?? null,
        manufacturedAt: input.manufacturedAt ?? null,
        notes: input.notes ?? ""
      },
      update: {
        quantityOnHand: { increment: qty },
        expiresAt: input.expiresAt ?? undefined,
        manufacturedAt: input.manufacturedAt ?? undefined,
        notes: input.notes || undefined,
        active: true
      }
    });

    if (input.bumpAggregate !== false && qty > 0) {
      const inv = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantityOnHand: { increment: qty } }
      });
      await tx.product.update({
        where: { id: input.productId },
        data: { stockQty: Math.max(0, inv.quantityOnHand - inv.quantityReserved) }
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          changeType: "restock",
          quantityChange: qty,
          quantityBefore: inv.quantityOnHand - qty,
          quantityAfter: inv.quantityOnHand,
          reservedAfter: inv.quantityReserved,
          referenceType: "lot",
          referenceId: updated.id,
          note: `Lot ${code} restock`
        }
      });
    }

    return updated;
  });

  return lot;
}

export async function listLotsForProduct(productId: string) {
  const inventory = await db.inventory.findUnique({ where: { productId } });
  if (!inventory) return [];
  return db.inventoryLot.findMany({
    where: { inventoryId: inventory.id },
    orderBy: [{ active: "desc" }, { expiresAt: "asc" }, { createdAt: "desc" }]
  });
}

/** Prefer real allocated lot codes; fall back to synthetic warehouse label. */
export function provenanceLabelForItems(
  items: { lotCodes?: string | null }[],
  fallbackBatch: string
) {
  const codes = items.map((i) => i.lotCodes?.trim()).filter(Boolean) as string[];
  if (codes.length === 0) return fallbackBatch;
  return Array.from(new Set(codes)).join(" · ");
}
