"use client";

import { updateOrderShippingAction } from "@/app/(admin)/admin/(console)/actions";
import { FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={order.id} />
      <div className="min-w-[7rem] space-y-1">
        <Label htmlFor="shippingInr" className="text-[11px] font-medium text-muted-foreground">
          Shipping (₹)
        </Label>
        <Input
          id="shippingInr"
          name="shippingInr"
          type="number"
          defaultValue={String(Math.round(order.shippingCents / 100))}
          required
          className="h-8"
        />
      </div>
      <SaveButton pending={pending} label="Update" />
      <FormStatus state={state} />
      {unpaid && order.razorpayOrderId ? (
        <p className="basis-full text-[10px] text-muted-foreground">
          Clears pending Razorpay intent for the new total.
        </p>
      ) : null}
    </form>
  );
}
