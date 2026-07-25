import {
  addressesMatch,
  collapseAddressWs,
  type AddressMatchFields
} from "@/lib/customer/address-match";

export type CheckoutAddressMutation =
  | { kind: "none" }
  | { kind: "label_only"; addressId: string; label: string }
  | { kind: "upsert"; fields: AddressMatchFields & { label: string }; makeDefault: boolean };

/**
 * Server backstop for chip dirty: never trust client selectedAddressId alone.
 * Pure — safe to unit-test without Prisma.
 */
export function resolveCheckoutAddressMutation(input: {
  saveAddress: boolean;
  selectedAddressId: string | null;
  label: string;
  shipping: AddressMatchFields;
  selectedSnapshot: AddressMatchFields | null;
}): CheckoutAddressMutation {
  if (!input.saveAddress) return { kind: "none" };

  const label = input.label.trim().slice(0, 40) || "Home";

  if (input.selectedAddressId && input.selectedSnapshot) {
    const matchKeySame = addressesMatch(input.shipping, input.selectedSnapshot);
    if (matchKeySame) {
      const labelChanged =
        collapseAddressWs(label).toLowerCase() !==
        collapseAddressWs(input.selectedSnapshot.label ?? "").toLowerCase();
      if (labelChanged) {
        return { kind: "label_only", addressId: input.selectedAddressId, label };
      }
      return { kind: "none" };
    }
  }

  return {
    kind: "upsert",
    fields: { ...input.shipping, label },
    makeDefault: false
  };
}
