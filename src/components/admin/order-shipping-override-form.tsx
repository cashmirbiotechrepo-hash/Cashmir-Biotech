"use client";

import { updateOrderShippingAction } from "@/app/(admin)/admin/(console)/actions";
import {
  AdminField,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";

export function OrderShippingOverrideForm({
  order
}: {
  order: {
    id: string;
    status: string;
    shippingCents: number;
    totalCents: number;
    razorpayOrderId: string | null;
  };
}) {
  const { pending, state, onSubmit } = useAdminForm(updateOrderShippingAction, { refresh: true });
  const unpaid = order.status === "pending" || order.status === "payment_failed";
  const locked = order.status === "cancelled" || order.status === "refunded";

  if (locked) {
    return (
      <p className="text-xs text-muted-foreground">
        Shipping cannot be changed on cancelled or refunded orders.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="id" value={order.id} />
      <AdminField
        label="Shipping (₹)"
        name="shippingInr"
        type="number"
        defaultValue={String(Math.round(order.shippingCents / 100))}
      />
      <p className="text-xs text-muted-foreground">
        {unpaid
          ? order.razorpayOrderId
            ? "Changing this clears the pending Razorpay payment intent so the customer must pay the new total."
            : "Overrides the calculated fee for this order only. Store defaults still apply to new checkouts."
          : "Updates bookkeeping totals only. The amount already charged on Razorpay does not change — refund separately if needed."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SaveButton pending={pending} label="Update shipping" />
        <FormStatus state={state} />
      </div>
    </form>
  );
}
