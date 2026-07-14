"use client";

import { updateOrderFulfillmentAction } from "@/app/(admin)/admin/(console)/actions";
import {
  AdminField,
  AdminTextarea,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";

export function OrderFulfillmentForm({
  order
}: {
  order: {
    id: string;
    trackingNumber: string | null;
    carrier: string | null;
    adminNotes: string | null;
  };
}) {
  const { pending, state, onSubmit } = useAdminForm(updateOrderFulfillmentAction, { refresh: true });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="id" value={order.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          label="Tracking number"
          name="trackingNumber"
          defaultValue={order.trackingNumber ?? ""}
          required={false}
        />
        <AdminField
          label="Carrier"
          name="carrier"
          defaultValue={order.carrier ?? ""}
          required={false}
          placeholder="Delhivery, Bluedart…"
        />
      </div>
      <AdminTextarea
        label="Internal notes"
        name="adminNotes"
        defaultValue={order.adminNotes ?? ""}
        required={false}
        rows={3}
      />
      <div className="flex items-center gap-3">
        <SaveButton pending={pending} label="Save shipment details" />
        <FormStatus state={state} />
      </div>
    </form>
  );
}
