import "server-only";

import { db } from "@/lib/db";
import {
  addressFingerprint,
  normalizeAddressFields,
  upsertCustomerAddress,
  type AddressFields
} from "@/lib/customer/addresses";

const CLAIM_ORDER_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "delivered",
  "partially_refunded",
  "refunded"
] as const;

export type ClaimableAddressSnapshot = AddressFields & {
  label: string;
  fingerprint: string;
  sourceOrderNumber: string;
};

function shippingFromOrder(order: {
  orderNumber: string;
  customerName: string | null;
  customerPhone: string;
  shippingAddress: unknown;
}): (AddressFields & { label: string }) | null {
  const shipping = order.shippingAddress as Record<string, unknown> | null;
  if (!shipping || typeof shipping.line1 !== "string" || !shipping.line1.trim()) {
    return null;
  }
  return {
    fullName: String(shipping.fullName ?? order.customerName ?? "").trim() || "Customer",
    phone: String(shipping.phone ?? order.customerPhone ?? "").trim(),
    line1: String(shipping.line1),
    line2: String(shipping.line2 ?? ""),
    city: String(shipping.city ?? ""),
    state: String(shipping.state ?? ""),
    postalCode: String(shipping.postalCode ?? ""),
    country: String(shipping.country ?? "India"),
    label: "Home"
  };
}

/**
 * Distinct shipping snapshots from guest/linked orders not yet in the address book.
 * Honors addressClaimPromptDismissedAt unless `ignoreDismiss` (used by confirm action).
 */
export async function listClaimableAddressSnapshots(
  customerId: string,
  opts?: { ignoreDismiss?: boolean }
): Promise<ClaimableAddressSnapshot[]> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      email: true,
      addressClaimPromptDismissedAt: true,
      addresses: { select: { fingerprint: true } }
    }
  });
  if (!customer) return [];
  if (!opts?.ignoreDismiss && customer.addressClaimPromptDismissedAt) return [];

  const email = customer.email.toLowerCase().trim();
  const existing = new Set(customer.addresses.map((a) => a.fingerprint));

  const orders = await db.order.findMany({
    where: {
      status: { in: [...CLAIM_ORDER_STATUSES] },
      OR: [{ customerId }, { customerId: null, customerEmail: email }]
    },
    select: {
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      shippingAddress: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 40
  });

  const byFp = new Map<string, ClaimableAddressSnapshot>();
  for (const order of orders) {
    const fields = shippingFromOrder(order);
    if (!fields) continue;
    if (!fields.city.trim() || !fields.postalCode.trim()) continue;
    const fingerprint = addressFingerprint(normalizeAddressFields(fields));
    if (existing.has(fingerprint)) continue;
    if (byFp.has(fingerprint)) continue;
    byFp.set(fingerprint, {
      ...fields,
      fingerprint,
      sourceOrderNumber: order.orderNumber
    });
  }

  return [...byFp.values()];
}

export async function dismissAddressClaimPrompt(customerId: string) {
  await db.customer.update({
    where: { id: customerId },
    data: { addressClaimPromptDismissedAt: new Date() }
  });
}

export async function confirmAddressClaim(customerId: string): Promise<{ added: number }> {
  const snapshots = await listClaimableAddressSnapshots(customerId, { ignoreDismiss: true });
  let added = 0;
  for (const snap of snapshots) {
    await upsertCustomerAddress(
      customerId,
      {
        label: snap.label,
        fullName: snap.fullName,
        phone: snap.phone,
        line1: snap.line1,
        line2: snap.line2,
        city: snap.city,
        state: snap.state,
        postalCode: snap.postalCode,
        country: snap.country
      },
      { makeDefault: false }
    );
    added += 1;
  }

  await db.customer.update({
    where: { id: customerId },
    data: { addressClaimPromptDismissedAt: new Date() }
  });

  return { added };
}
