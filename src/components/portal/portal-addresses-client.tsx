"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PortalAddressForm } from "@/components/portal/portal-address-form";

type AddressRow = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export function PortalAddressesClient({
  addresses,
  deleteAction,
  setDefaultAction
}: {
  addresses: AddressRow[];
  deleteAction: (addressId: string) => Promise<void>;
  setDefaultAction: (addressId: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  async function runSetDefault(addressId: string) {
    try {
      await setDefaultAction(addressId);
      toast.success("Default address updated.");
    } catch {
      toast.error("Could not update default address.");
    }
  }

  async function runDelete(addressId: string) {
    try {
      await deleteAction(addressId);
      toast.success("Address removed.");
    } catch {
      toast.error("Could not remove address.");
    }
  }

  return (
    <section className="space-y-4">
      {addresses.length === 0 ? (
        <p className="text-[13px] text-ink-mute">No saved addresses yet.</p>
      ) : (
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="border border-ink/10 bg-paper p-4">
              {editingId === a.id ? (
                <PortalAddressForm
                  mode="edit"
                  initialValues={a}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium text-ink">
                      {a.label}
                      {a.isDefault ? (
                        <span className="ml-2 text-[11px] font-medium text-gold">Default</span>
                      ) : null}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">
                      {a.fullName}
                      <br />
                      {a.line1}
                      {a.line2 ? (
                        <>
                          <br />
                          {a.line2}
                        </>
                      ) : null}
                      <br />
                      {a.city}, {a.state} {a.postalCode}
                      <br />
                      {a.phone}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[13px]">
                    <button
                      type="button"
                      onClick={() => setEditingId(a.id)}
                      className="text-ink-mute hover:text-ink"
                    >
                      Edit
                    </button>
                    {!a.isDefault ? (
                      <form action={runSetDefault.bind(null, a.id)}>
                        <button type="submit" className="text-ink-mute hover:text-ink">
                          Set default
                        </button>
                      </form>
                    ) : null}
                    <form action={runDelete.bind(null, a.id)}>
                      <button type="submit" className="text-red-700/80 hover:text-red-700">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="mb-2 text-[13px] font-medium text-ink-mute">Add address</h3>
        <PortalAddressForm mode="create" />
      </div>
    </section>
  );
}
