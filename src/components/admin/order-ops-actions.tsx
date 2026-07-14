"use client";

import { ensureInvoiceForOrderAction, refundOrderAction } from "@/app/(admin)/admin/(console)/order-ops-actions";
import { FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";

export function GenerateInvoiceButton({ orderId }: { orderId: string }) {
  const { pending, state, onSubmit } = useAdminForm(ensureInvoiceForOrderAction, { refresh: true });

  return (
    <form onSubmit={onSubmit} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <SaveButton pending={pending} label="Generate invoice" />
      <FormStatus state={state} />
    </form>
  );
}

export function RefundOrderForm({
  orderId,
  totalCents,
  refundedCents = 0,
  disabled
}: {
  orderId: string;
  totalCents: number;
  refundedCents?: number;
  disabled?: boolean;
}) {
  const { pending, state, onSubmit } = useAdminForm(refundOrderAction, { refresh: true });
  const remainingInr = Math.max(0, (totalCents - refundedCents) / 100);

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">Issue Razorpay refund</p>
      <p className="text-xs text-muted-foreground">
        Remaining refundable: ₹{remainingInr.toFixed(2)}
        {refundedCents > 0 ? ` (already refunded ₹${(refundedCents / 100).toFixed(2)})` : ""}
      </p>
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block text-xs text-muted-foreground">
        Amount (INR) — leave blank for full remaining
        <input
          name="amountInr"
          type="number"
          step="0.01"
          min="0.01"
          max={remainingInr}
          placeholder={remainingInr.toFixed(2)}
          disabled={disabled || pending}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Reason
        <input
          name="reason"
          defaultValue="Customer request"
          disabled={disabled || pending}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="restock" defaultChecked disabled={disabled || pending} />
        Restock inventory (only on full refund)
      </label>
      <SaveButton pending={pending} label="Issue refund" disabled={disabled || remainingInr <= 0} />
      <FormStatus state={state} />
    </form>
  );
}
