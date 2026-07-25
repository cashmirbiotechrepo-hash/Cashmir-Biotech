import "server-only";

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureCustomerFromCheckout, attachOrderToCustomer } from "@/lib/customer/auth";
import { normalizePhoneForMatch } from "@/lib/customer/phone-in";
import {
  addressMatchCanonical,
  addressesMatch,
  collapseAddressWs,
  normalizeAddressFields,
  type AddressMatchFields,
  type NormalizedAddress
} from "@/lib/customer/address-match";
import { resolveCheckoutAddressMutation } from "@/lib/customer/checkout-address-mutation";

export type AddressFields = AddressMatchFields;
export type { NormalizedAddress };
export { normalizeAddressFields, addressesMatch, resolveCheckoutAddressMutation };

export function addressFingerprint(normalized: NormalizedAddress): string {
  return createHash("sha256").update(addressMatchCanonical(normalized)).digest("hex");
}

type Tx = Prisma.TransactionClient;

export async function findMatchingAddress(
  customerId: string,
  fields: AddressFields,
  opts?: { excludeId?: string; tx?: Tx }
) {
  const fingerprint = addressFingerprint(normalizeAddressFields(fields));
  const client = opts?.tx ?? db;
  return client.customerAddress.findFirst({
    where: {
      customerId,
      fingerprint,
      ...(opts?.excludeId ? { id: { not: opts.excludeId } } : {})
    }
  });
}

export async function assertAddressOwned(customerId: string, addressId: string, tx?: Tx) {
  const client = tx ?? db;
  return client.customerAddress.findFirst({ where: { id: addressId, customerId } });
}

async function clearDefaults(tx: Tx, customerId: string) {
  await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
}

async function promoteLatestDefault(tx: Tx, customerId: string) {
  const next = await tx.customerAddress.findFirst({
    where: { customerId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }]
  });
  if (next) {
    await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

export async function withDefaultAddressInvariant<T>(
  customerId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => fn(tx));
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function buildAddressWriteData(payload: AddressFields & { label: string }) {
  const normalized = normalizeAddressFields(payload);
  const fingerprint = addressFingerprint(normalized);
  const label = payload.label.trim().slice(0, 40) || "Home";
  return {
    label,
    fullName: collapseAddressWs(payload.fullName),
    phone: normalizePhoneForMatch(payload.phone) || collapseAddressWs(payload.phone),
    line1: collapseAddressWs(payload.line1),
    line2: collapseAddressWs(payload.line2 ?? ""),
    city: collapseAddressWs(payload.city),
    state: collapseAddressWs(payload.state),
    postalCode: normalized.postalCode || collapseAddressWs(payload.postalCode),
    country: collapseAddressWs(payload.country || "India") || "India",
    fingerprint
  };
}

export type UpsertAddressResult = {
  id: string;
  created: boolean;
};

/**
 * Single upsert implementation for portal + payment sync.
 * Uses Prisma native upsert (`INSERT … ON CONFLICT`) — never catch P2002 inside
 * an interactive transaction (Postgres aborts the txn on constraint failure).
 */
export async function upsertAddressWithinTx(
  tx: Tx,
  customerId: string,
  payload: AddressFields & { label: string },
  opts?: { makeDefault?: boolean }
): Promise<UpsertAddressResult> {
  const data = buildAddressWriteData(payload);
  const count = await tx.customerAddress.count({ where: { customerId } });
  const makeDefault = count === 0 ? true : Boolean(opts?.makeDefault);

  if (makeDefault) await clearDefaults(tx, customerId);

  const before = await tx.customerAddress.findUnique({
    where: { customerId_fingerprint: { customerId, fingerprint: data.fingerprint } },
    select: { id: true }
  });

  const upserted = await tx.customerAddress.upsert({
    where: { customerId_fingerprint: { customerId, fingerprint: data.fingerprint } },
    create: { customerId, ...data, isDefault: makeDefault },
    update: { ...data, ...(makeDefault ? { isDefault: true } : {}) }
  });

  return { id: upserted.id, created: !before };
}

export async function upsertCustomerAddress(
  customerId: string,
  payload: AddressFields & { label: string },
  opts?: { makeDefault?: boolean }
): Promise<UpsertAddressResult> {
  return withDefaultAddressInvariant(customerId, (tx) =>
    upsertAddressWithinTx(tx, customerId, payload, opts)
  );
}

export async function updatePortalAddressFields(
  customerId: string,
  addressId: string,
  payload: AddressFields & { label: string; isDefault?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await assertAddressOwned(customerId, addressId);
  if (!owned) return { ok: false, error: "Address not found." };

  const collision = await findMatchingAddress(customerId, payload, { excludeId: addressId });
  if (collision) {
    return { ok: false, error: "You already have this address saved." };
  }

  const data = buildAddressWriteData(payload);

  try {
    await withDefaultAddressInvariant(customerId, async (tx) => {
      if (payload.isDefault) await clearDefaults(tx, customerId);
      await tx.customerAddress.update({
        where: { id: addressId },
        data: {
          ...data,
          ...(payload.isDefault ? { isDefault: true } : {})
        }
      });
    });
    return { ok: true };
  } catch (err) {
    // Whole interactive txn is rolled back on P2002 — safe to catch at the boundary.
    if (isUniqueViolation(err)) {
      return { ok: false, error: "You already have this address saved." };
    }
    throw err;
  }
}

export async function deleteOwnedAddress(customerId: string, addressId: string) {
  await withDefaultAddressInvariant(customerId, async (tx) => {
    const owned = await tx.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!owned) return;
    const wasDefault = owned.isDefault;
    await tx.customerAddress.delete({ where: { id: addressId } });
    if (wasDefault) await promoteLatestDefault(tx, customerId);
  });
}

export async function setOwnedDefaultAddress(customerId: string, addressId: string) {
  await withDefaultAddressInvariant(customerId, async (tx) => {
    const owned = await tx.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!owned) return;
    await clearDefaults(tx, customerId);
    await tx.customerAddress.update({ where: { id: addressId }, data: { isDefault: true } });
  });
}

const SYNC_BUDGET_MS = 400;

export async function syncAccountAfterOrder(orderId: string): Promise<{ ok: boolean }> {
  return db.$transaction(async (tx) => {
    // Cast to text: Prisma params are untyped; hashtext(unknown) is ambiguous.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('account_sync'),
        hashtext(${orderId}::text)
      )
    `;

    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return { ok: false };
    if (order.accountSyncedAt) return { ok: true };

    const customerId = order.customerId;
    if (!customerId) return { ok: false };

    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { ok: false };

    if ((!customer.name || !customer.phone) && (order.customerName || order.customerPhone)) {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(order.customerName && !customer.name ? { name: order.customerName } : {}),
          ...(order.customerPhone && !customer.phone
            ? { phone: normalizePhoneForMatch(order.customerPhone) || order.customerPhone }
            : {})
        }
      });
    }

    if (order.saveAddressToAccount) {
      const shipping = order.shippingAddress as Record<string, unknown> | null;
      if (shipping && typeof shipping.line1 === "string") {
        const fields: AddressFields & { label: string } = {
          fullName: String(shipping.fullName ?? order.customerName ?? ""),
          phone: String(shipping.phone ?? order.customerPhone ?? ""),
          line1: String(shipping.line1),
          line2: String(shipping.line2 ?? ""),
          city: String(shipping.city ?? ""),
          state: String(shipping.state ?? ""),
          postalCode: String(shipping.postalCode ?? ""),
          country: String(shipping.country ?? "India"),
          label: (order.accountAddressLabel || "Home").slice(0, 40)
        };

        let selectedSnapshot: AddressFields | null = null;
        if (order.selectedAddressId) {
          const selected = await tx.customerAddress.findFirst({
            where: { id: order.selectedAddressId, customerId }
          });
          if (selected) {
            selectedSnapshot = {
              fullName: selected.fullName,
              phone: selected.phone,
              line1: selected.line1,
              line2: selected.line2,
              city: selected.city,
              state: selected.state,
              postalCode: selected.postalCode,
              country: selected.country,
              label: selected.label
            };
          }
        }

        const mutation = resolveCheckoutAddressMutation({
          saveAddress: true,
          selectedAddressId: order.selectedAddressId,
          label: fields.label,
          shipping: fields,
          selectedSnapshot
        });

        if (mutation.kind === "label_only") {
          await tx.customerAddress.updateMany({
            where: { id: mutation.addressId, customerId },
            data: { label: mutation.label }
          });
        } else if (mutation.kind === "upsert") {
          await upsertAddressWithinTx(tx, customerId, mutation.fields, { makeDefault: false });
        }
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: { accountSyncedAt: new Date() }
    });

    return { ok: true };
  });
}

export async function syncWithBudget(
  orderId: string,
  opts?: { ms?: number }
): Promise<"ok" | "unknown" | "skipped"> {
  const budget = opts?.ms ?? SYNC_BUDGET_MS;

  try {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return "skipped";
    if (order.accountSyncedAt) return "ok";

    let customerId = order.customerId;
    if (!customerId && order.customerEmail) {
      customerId = await ensureCustomerFromCheckout({
        email: order.customerEmail,
        name: order.customerName,
        phone: order.customerPhone
      });
      if (customerId) await attachOrderToCustomer(orderId, customerId);
    }
    if (!customerId) {
      logger.warn({ orderId, event: "checkout_account_sync_no_customer" }, "account sync skipped — no customer");
      return "skipped";
    }
  } catch (err) {
    logger.error(
      { err, orderId, event: "checkout_account_sync_failed", sync_status: "unknown" },
      "account sync customer attach failed"
    );
    return "unknown";
  }

  const work = syncAccountAfterOrder(orderId);
  const result = await Promise.race([
    work.then((r) => (r.ok ? ("ok" as const) : ("unknown" as const))).catch((err: unknown) => {
      logger.error(
        { err, orderId, event: "checkout_account_sync_failed", sync_status: "unknown" },
        "account sync failed"
      );
      return "unknown" as const;
    }),
    new Promise<"unknown">((resolve) => {
      setTimeout(() => {
        logger.warn(
          { orderId, event: "checkout_account_sync_timeout", sync_status: "unknown", budgetMs: budget },
          "account sync timed out"
        );
        resolve("unknown");
      }, budget);
    })
  ]);

  return result;
}
