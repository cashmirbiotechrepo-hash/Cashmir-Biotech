import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

type Tx = Prisma.TransactionClient;

export type InventoryChangeType =
  | "initial_stock"
  | "order_placed"
  | "order_confirmed"
  | "order_cancelled"
  | "order_returned"
  | "manual_adjustment"
  | "restock"
  | "damaged";

export type StockLine = { productId: string | null; quantity: number; productName?: string };

type InventorySnapshot = {
  id: string;
  productId: string;
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
};

/** Statuses that mean the order is confirmed and physical stock should be deducted. */
const DEDUCT_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);
/** Statuses that mean stock should be returned to on-hand. */
const RESTORE_STATUSES = new Set(["cancelled", "refunded", "payment_failed"]);

export function shouldDeduct(status: string) {
  return DEDUCT_STATUSES.has(status);
}
export function shouldRestore(status: string) {
  return RESTORE_STATUSES.has(status);
}

async function alertLowStock(snapshot: InventorySnapshot, productName: string) {
  const available = snapshot.quantityOnHand - snapshot.quantityReserved;
  if (available > snapshot.lowStockThreshold) return;

  logger.warn(
    { event: "inventory_low_stock", productId: snapshot.productId, sku: snapshot.sku, available },
    "inventory dropped to/below low-stock threshold"
  );

  const to = process.env.INVENTORY_ALERT_EMAIL || process.env.SMTP_USER;
  if (!to) return;
  const { buildLowStockMail } = await import("@/lib/email/transactional");
  const { sendTransactionalMail } = await import("@/lib/admin/mail");
  // Extract mailbox if SMTP_FROM was used previously with display name
  const toAddr = to.includes("<") ? (to.match(/<([^>]+)>/)?.[1] ?? to) : to;
  const mail = buildLowStockMail({
    productName,
    sku: snapshot.sku,
    available,
    threshold: snapshot.lowStockThreshold
  });
  await sendTransactionalMail({ to: toAddr, mail }).catch(() => undefined);
}

/** Applies an on-hand delta (and optional reserved delta), mirrors available qty to Product.stockQty, and appends a transaction row.
 * H9: Inventory is source of truth; Product.stockQty is denormalized (onHand − reserved) for catalog reads. */
async function applyDelta(
  tx: Tx,
  inventory: InventorySnapshot,
  delta: number,
  changeType: InventoryChangeType,
  opts: {
    referenceType?: string;
    referenceId?: string | null;
    note?: string;
    createdBy?: string | null;
    reservedDelta?: number;
  } = {}
): Promise<InventorySnapshot> {
  const before = inventory.quantityOnHand;
  const after = before + delta;
  const reservedAfter = Math.max(0, inventory.quantityReserved + (opts.reservedDelta ?? 0));
  const available = Math.max(0, after - reservedAfter);

  const updated = await tx.inventory.update({
    where: { id: inventory.id },
    data: { quantityOnHand: after, quantityReserved: reservedAfter }
  });
  await tx.product.update({ where: { id: inventory.productId }, data: { stockQty: available } });
  await tx.inventoryTransaction.create({
    data: {
      inventoryId: inventory.id,
      changeType,
      quantityChange: delta,
      quantityBefore: before,
      quantityAfter: after,
      reservedAfter,
      referenceType: opts.referenceType ?? "manual",
      referenceId: opts.referenceId ?? null,
      note: opts.note ?? "",
      createdBy: opts.createdBy ?? null
    }
  });

  return {
    id: updated.id,
    productId: updated.productId,
    sku: updated.sku,
    quantityOnHand: updated.quantityOnHand,
    quantityReserved: updated.quantityReserved,
    lowStockThreshold: updated.lowStockThreshold
  };
}

/** Creates the inventory row for a brand-new product (called inside the product-create transaction). */
export async function initializeInventory(
  tx: Tx,
  input: { productId: string; sku: string; quantity: number; threshold: number; createdBy?: string | null }
) {
  const inventory = await tx.inventory.create({
    data: {
      productId: input.productId,
      sku: input.sku,
      quantityOnHand: input.quantity,
      lowStockThreshold: input.threshold
    }
  });
  if (input.quantity !== 0) {
    await tx.inventoryTransaction.create({
      data: {
        inventoryId: inventory.id,
        changeType: "initial_stock",
        quantityChange: input.quantity,
        quantityBefore: 0,
        quantityAfter: input.quantity,
        reservedAfter: 0,
        referenceType: "manual",
        note: "Initial stock on product creation",
        createdBy: input.createdBy ?? null
      }
    });
  }
  return inventory;
}

/** Lazily returns an inventory row, creating one from the product's current stockQty if missing. */
export async function ensureInventory(productId: string, client: Tx | typeof db = db): Promise<InventorySnapshot> {
  const existing = await client.inventory.findUnique({ where: { productId } });
  if (existing) {
    return {
      id: existing.id,
      productId: existing.productId,
      sku: existing.sku,
      quantityOnHand: existing.quantityOnHand,
      quantityReserved: existing.quantityReserved,
      lowStockThreshold: existing.lowStockThreshold
    };
  }
  const product = await client.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error(`Product ${productId} not found`);

  // Nested create when already inside an interactive tx: use the same client.
  const created = await initializeInventory(client as Tx, {
    productId: product.id,
    sku: product.sku,
    quantity: product.stockQty,
    threshold: product.lowStockThreshold
  });
  return {
    id: created.id,
    productId: created.productId,
    sku: created.sku,
    quantityOnHand: created.quantityOnHand,
    quantityReserved: created.quantityReserved,
    lowStockThreshold: created.lowStockThreshold
  };
}

/** Reconciles inventory when an admin edits stock / threshold directly on the product form. */
export async function reconcileFromProductForm(input: {
  productId: string;
  sku: string;
  newOnHand: number;
  threshold: number;
  createdBy?: string | null;
}) {
  const snapshot = await ensureInventory(input.productId);
  await db.$transaction(async (tx) => {
    if (snapshot.lowStockThreshold !== input.threshold || snapshot.sku !== input.sku) {
      await tx.inventory.update({
        where: { id: snapshot.id },
        data: { lowStockThreshold: input.threshold, sku: input.sku }
      });
    }
    const delta = input.newOnHand - snapshot.quantityOnHand;
    if (delta !== 0) {
      await applyDelta(tx, { ...snapshot, lowStockThreshold: input.threshold, sku: input.sku }, delta, "manual_adjustment", {
        note: "Adjusted from product editor",
        createdBy: input.createdBy
      });
    }
  });
}

/** Manual stock change from the inventory screen (restock, damaged, correction). */
export async function adjustStockManually(input: {
  productId: string;
  delta: number;
  changeType: InventoryChangeType;
  note?: string;
  createdBy?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshot = await ensureInventory(input.productId);
  if (snapshot.quantityOnHand + input.delta < 0) {
    return { ok: false, error: "Adjustment would make on-hand stock negative." };
  }
  const product = await db.product.findUnique({ where: { id: input.productId }, select: { name: true } });
  const result = await db.$transaction((tx) =>
    applyDelta(tx, snapshot, input.delta, input.changeType, {
      note: input.note,
      createdBy: input.createdBy
    })
  );
  await alertLowStock(result, product?.name ?? "Product");
  return { ok: true };
}

/**
 * Deducts physical stock for a confirmed order. Idempotency is enforced by the caller (Order.stockDeducted).
 * When `releaseReserved` is set, the matching reservation created at checkout is also drawn down so a
 * reserved unit is not double-counted after it becomes an actual deduction.
 * Also allocates FEFO InventoryLot rows onto each OrderItem (true lot provenance) before aggregate deduct.
 */
export async function deductStockForOrder(input: {
  orderId: string;
  lines: StockLine[];
  releaseReserved?: boolean;
  createdBy?: string | null;
}) {
  const { allocateLotsForFulfillment } = await import("@/modules/admin/services/inventory-lots.service");
  const trackable = await filterTrackable(input.lines);
  const orderItems = await db.orderItem.findMany({ where: { orderId: input.orderId } });

  for (const line of trackable) {
    const snapshot = await ensureInventory(line.productId);
    const result = await db.$transaction(async (tx) => {
      const matching = orderItems.filter((i) => i.productId === line.productId);
      let qtyLeft = line.quantity;
      for (const item of matching) {
        if (qtyLeft <= 0) break;
        const take = Math.min(item.quantity, qtyLeft);
        await allocateLotsForFulfillment(
          { productId: line.productId, orderItemId: item.id, quantity: take },
          tx
        );
        qtyLeft -= take;
      }

      return applyDelta(tx, snapshot, -line.quantity, "order_confirmed", {
        referenceType: "order",
        referenceId: input.orderId,
        note: `Order fulfillment`,
        createdBy: input.createdBy,
        reservedDelta: input.releaseReserved ? -line.quantity : 0
      });
    });
    await alertLowStock(result, line.productName ?? "Product");
  }
}

/** Returns stock to on-hand when an order is cancelled or refunded. */
export async function restoreStockForOrder(input: {
  orderId: string;
  lines: StockLine[];
  changeType?: Extract<InventoryChangeType, "order_cancelled" | "order_returned">;
  createdBy?: string | null;
}) {
  const { restoreLotsForOrderItem } = await import("@/modules/admin/services/inventory-lots.service");
  const trackable = await filterTrackable(input.lines);
  const orderItems = await db.orderItem.findMany({ where: { orderId: input.orderId } });

  for (const line of trackable) {
    const snapshot = await ensureInventory(line.productId);
    await db.$transaction(async (tx) => {
      await applyDelta(tx, snapshot, line.quantity, input.changeType ?? "order_cancelled", {
        referenceType: "order",
        referenceId: input.orderId,
        note: `Stock returned from order`,
        createdBy: input.createdBy
      });
      for (const item of orderItems.filter((i) => i.productId === line.productId)) {
        await restoreLotsForOrderItem(item.id, tx);
      }
    });
  }
}

/**
 * Reserves stock atomically (for a future live checkout). Uses a guarded UPDATE so two concurrent
 * orders can't both grab the last unit — the classic oversell bug.
 */
export async function reserveStock(input: { productId: string; quantity: number }): Promise<boolean> {
  const snapshot = await ensureInventory(input.productId);
  const affected = await db.$executeRaw`
    UPDATE "Inventory"
    SET "quantityReserved" = "quantityReserved" + ${input.quantity}, "updatedAt" = now()
    WHERE "id" = ${snapshot.id} AND ("quantityOnHand" - "quantityReserved") >= ${input.quantity}`;
  if (affected === 0) return false;

  await db.inventoryTransaction.create({
    data: {
      inventoryId: snapshot.id,
      changeType: "order_placed",
      quantityChange: -input.quantity,
      quantityBefore: snapshot.quantityOnHand,
      quantityAfter: snapshot.quantityOnHand,
      reservedAfter: snapshot.quantityReserved + input.quantity,
      referenceType: "order",
      note: "Reserved at checkout"
    }
  });
  return true;
}

/** Releases a reservation (e.g. abandoned/cancelled cart before payment). */
export async function releaseStock(input: { productId: string; quantity: number }) {
  const snapshot = await ensureInventory(input.productId);
  await db.$executeRaw`
    UPDATE "Inventory"
    SET "quantityReserved" = GREATEST("quantityReserved" - ${input.quantity}, 0), "updatedAt" = now()
    WHERE "id" = ${snapshot.id}`;
}

/**
 * Reserves stock for every trackable line of an order, all-or-nothing. Uses guarded atomic UPDATEs so
 * concurrent checkouts can never oversell the last unit. If any line can't be satisfied, all previously
 * reserved lines in this call are rolled back and `ok: false` is returned.
 */
export async function reserveStockForOrder(input: {
  orderId: string;
  lines: StockLine[];
  /** When provided, reservations participate in the caller's interactive transaction. */
  tx?: Tx;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = input.tx ?? db;
  const trackable = await filterTrackable(input.lines, client);
  const reserved: Array<{ productId: string; quantity: number }> = [];

  for (const line of trackable) {
    const snapshot = await ensureInventory(line.productId, client);
    const affected = await client.$executeRaw`
      UPDATE "Inventory"
      SET "quantityReserved" = "quantityReserved" + ${line.quantity}, "updatedAt" = now()
      WHERE "id" = ${snapshot.id} AND ("quantityOnHand" - "quantityReserved") >= ${line.quantity}`;

    if (affected === 0) {
      for (const r of reserved) {
        await client.$executeRaw`
          UPDATE "Inventory"
          SET "quantityReserved" = GREATEST("quantityReserved" - ${r.quantity}, 0), "updatedAt" = now()
          WHERE "productId" = ${r.productId}`.catch(() => undefined);
      }
      return { ok: false, error: `Not enough stock for ${line.productName ?? "an item"}.` };
    }

    const fresh = await client.inventory.findUnique({ where: { id: snapshot.id } });
    if (fresh) {
      await client.inventoryTransaction.create({
        data: {
          inventoryId: snapshot.id,
          changeType: "order_placed",
          quantityChange: 0,
          quantityBefore: fresh.quantityOnHand,
          quantityAfter: fresh.quantityOnHand,
          reservedAfter: fresh.quantityReserved,
          referenceType: "order",
          referenceId: input.orderId,
          note: "Reserved at checkout"
        }
      });
      // Keep Product.stockQty = available (H9 denormalized mirror).
      await client.product.update({
        where: { id: line.productId },
        data: { stockQty: Math.max(0, fresh.quantityOnHand - fresh.quantityReserved) }
      });
    }
    reserved.push({ productId: line.productId, quantity: line.quantity });
  }

  return { ok: true };
}

/** Releases all reservations held for an order (payment failed/expired/cancelled before deduction). */
export async function releaseReservationForOrder(input: { orderId: string; lines: StockLine[] }) {
  const trackable = await filterTrackable(input.lines);
  for (const line of trackable) {
    const snapshot = await ensureInventory(line.productId);
    await db.$transaction((tx) =>
      applyDelta(tx, snapshot, 0, "order_cancelled", {
        referenceType: "order",
        referenceId: input.orderId,
        note: "Reservation released",
        reservedDelta: -line.quantity
      })
    );
  }
}

export async function getAvailableQuantity(sku: string): Promise<number | null> {
  const inv = await db.inventory.findFirst({ where: { sku } });
  if (!inv) return null;
  return inv.quantityOnHand - inv.quantityReserved;
}

async function filterTrackable(
  lines: StockLine[],
  client: Tx | typeof db = db
): Promise<Array<StockLine & { productId: string }>> {
  const withProduct = lines.filter((l): l is StockLine & { productId: string } => Boolean(l.productId) && l.quantity > 0);
  if (withProduct.length === 0) return [];
  const products = await client.product.findMany({
    where: { id: { in: withProduct.map((l) => l.productId) }, hasInventoryTracking: true },
    select: { id: true }
  });
  const tracked = new Set(products.map((p) => p.id));
  return withProduct.filter((l) => tracked.has(l.productId));
}

/** Sets on-hand to an exact target, logging the difference as a manual adjustment. */
export async function setOnHand(input: { productId: string; target: number; note?: string; createdBy?: string | null }) {
  const snapshot = await ensureInventory(input.productId);
  const delta = input.target - snapshot.quantityOnHand;
  if (delta === 0) return { ok: true as const };
  return adjustStockManually({
    productId: input.productId,
    delta,
    changeType: "manual_adjustment",
    note: input.note,
    createdBy: input.createdBy
  });
}

/** Creates inventory rows for any trackable product that doesn't have one yet. */
export async function backfillInventory() {
  const products = await db.product.findMany({
    where: { hasInventoryTracking: true, inventory: { is: null } },
    select: { id: true }
  });
  for (const product of products) {
    await ensureInventory(product.id).catch(() => undefined);
  }
  return products.length;
}

export type InventoryOverviewRow = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string;
  active: boolean;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  lowStockThreshold: number;
  isLow: boolean;
  updatedAt: Date;
};

export async function listInventory(params: {
  q?: string;
  lowOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ items: InventoryOverviewRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;
  const q = params.q?.trim();

  const where: Prisma.InventoryWhereInput = {
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { product: { name: { contains: q, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const include = { product: { select: { name: true, imageUrl: true, active: true } } } as const;

  if (params.lowOnly) {
    const q = params.q?.trim() ? `%${params.q.trim()}%` : null;
    const skip = (page - 1) * pageSize;

    const rawRows = await db.$queryRaw<
      {
        id: string;
        productId: string;
        sku: string;
        quantityOnHand: number;
        quantityReserved: number;
        lowStockThreshold: number;
        updatedAt: Date;
        productName: string;
        imageUrl: string;
        active: boolean;
      }[]
    >`
      SELECT i.*, p.name as "productName", p."imageUrl", p.active
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE (i."quantityOnHand" - i."quantityReserved") <= i."lowStockThreshold"
        AND (${q}::text IS NULL OR i.sku ILIKE ${q} OR p.name ILIKE ${q})
      ORDER BY (i."quantityOnHand" - i."quantityReserved") ASC
      LIMIT ${pageSize} OFFSET ${skip}
    `;

    const countRes = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE (i."quantityOnHand" - i."quantityReserved") <= i."lowStockThreshold"
        AND (${q}::text IS NULL OR i.sku ILIKE ${q} OR p.name ILIKE ${q})
    `;

    const total = Number(countRes[0]?.count ?? 0);
    const items = rawRows.map((r) => {
      const available = r.quantityOnHand - r.quantityReserved;
      return {
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        imageUrl: r.imageUrl,
        active: r.active,
        quantityOnHand: r.quantityOnHand,
        quantityReserved: r.quantityReserved,
        quantityAvailable: available,
        lowStockThreshold: r.lowStockThreshold,
        isLow: available <= r.lowStockThreshold,
        updatedAt: r.updatedAt
      };
    });

    return { items, total };
  }

  const [rows, total] = await Promise.all([
    db.inventory.findMany({
      where,
      include,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.inventory.count({ where })
  ]);

  const items = rows.map((r) => {
    const available = r.quantityOnHand - r.quantityReserved;
    return {
      id: r.id,
      productId: r.productId,
      productName: r.product.name,
      sku: r.sku,
      imageUrl: r.product.imageUrl,
      active: r.product.active,
      quantityOnHand: r.quantityOnHand,
      quantityReserved: r.quantityReserved,
      quantityAvailable: available,
      lowStockThreshold: r.lowStockThreshold,
      isLow: available <= r.lowStockThreshold,
      updatedAt: r.updatedAt
    };
  });

  return { items, total };
}

export async function listInventoryTransactions(productId: string, limit = 50) {
  const inventory = await db.inventory.findUnique({ where: { productId } });
  if (!inventory) return [];
  return db.inventoryTransaction.findMany({
    where: { inventoryId: inventory.id },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
