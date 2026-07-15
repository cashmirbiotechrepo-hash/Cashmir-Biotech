"use client";

import { saveShippingSettingsAction } from "@/app/(admin)/admin/(console)/actions";
import {
  AdminField,
  FormStatus,
  SaveButton,
  useAdminForm
} from "@/components/admin/admin-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ShippingSettingsForm({
  flatShippingInr,
  freeShippingThresholdInr
}: {
  flatShippingInr: number;
  freeShippingThresholdInr: number;
}) {
  const { pending, state, onSubmit } = useAdminForm(saveShippingSettingsAction, { refresh: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Store-wide defaults</CardTitle>
        <CardDescription>
          Applied automatically on cart and checkout. You can still override shipping on an individual
          order from its workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid max-w-md gap-4">
          <AdminField
            label="Flat delivery fee (₹)"
            name="flatShippingInr"
            type="number"
            defaultValue={String(flatShippingInr)}
          />
          <AdminField
            label="Free shipping from (₹)"
            name="freeShippingThresholdInr"
            type="number"
            defaultValue={String(freeShippingThresholdInr)}
          />
          <p className="text-xs text-muted-foreground">
            Example: fee ₹{flatShippingInr}, free at ₹{freeShippingThresholdInr}+ subtotal after
            discounts.
          </p>
          <div className="flex items-center gap-3">
            <SaveButton pending={pending} label="Save shipping defaults" />
            <FormStatus state={state} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
