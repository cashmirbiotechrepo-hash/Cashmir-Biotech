"use client";

import { ensureInvoiceForOrderAction } from "@/app/(admin)/admin/(console)/order-ops-actions";
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
