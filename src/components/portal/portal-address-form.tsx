"use client";

import { useActionState, useState } from "react";
import {
  savePortalAddress,
  updatePortalAddressAction,
  type PortalAddressState
} from "@/app/(portal)/portal/(session)/actions";
import { usePortalActionToast } from "@/components/portal/use-portal-action-toast";

const initial: PortalAddressState = {};

export type PortalAddressFormValues = {
  id?: string;
  label?: string;
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
};

function labelPresetFrom(label: string | undefined): "Home" | "Work" | "Other" {
  if (label === "Home" || label === "Work") return label;
  if (!label) return "Home";
  return "Other";
}

export function PortalAddressForm({
  mode = "create",
  initialValues,
  onCancel
}: {
  mode?: "create" | "edit";
  initialValues?: PortalAddressFormValues;
  onCancel?: () => void;
}) {
  const boundUpdate = initialValues?.id
    ? updatePortalAddressAction.bind(null, initialValues.id)
    : savePortalAddress;
  const [state, action, pending] = useActionState(
    mode === "edit" ? boundUpdate : savePortalAddress,
    initial
  );
  usePortalActionToast(state, {
    success: mode === "edit" ? "Address updated." : "Address saved."
  });
  const preset0 = labelPresetFrom(initialValues?.label);
  const [preset, setPreset] = useState<"Home" | "Work" | "Other">(preset0);
  const [customLabel, setCustomLabel] = useState(
    preset0 === "Other" ? (initialValues?.label ?? "") : ""
  );

  return (
    <form action={action} className="grid max-w-xl gap-3 sm:grid-cols-2" noValidate>
      {state.error ? (
        <p
          role="alert"
          className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Label</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(["Home", "Work", "Other"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={
                preset === p
                  ? "rounded-full bg-ink px-3 py-1.5 text-[12px] text-paper"
                  : "rounded-full border border-ink/15 px-3 py-1.5 text-[12px] text-ink-mute"
              }
            >
              {p}
            </button>
          ))}
        </div>
        <input type="hidden" name="labelPreset" value={preset} />
        {preset === "Other" ? (
          <input
            name="labelCustom"
            required
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="e.g. Mom’s house"
            maxLength={40}
            className="mt-2 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
          />
        ) : (
          <input type="hidden" name="labelCustom" value="" />
        )}
      </div>

      <Field name="fullName" label="Full name" required defaultValue={initialValues?.fullName} />
      <Field name="phone" label="Mobile (India)" required defaultValue={initialValues?.phone} />
      <Field
        name="line1"
        label="Address line 1"
        required
        className="sm:col-span-2"
        defaultValue={initialValues?.line1}
      />
      <Field
        name="line2"
        label="Address line 2"
        className="sm:col-span-2"
        defaultValue={initialValues?.line2}
      />
      <Field name="city" label="City" required defaultValue={initialValues?.city} />
      <Field name="state" label="State" required defaultValue={initialValues?.state} />
      <Field name="postalCode" label="PIN" required defaultValue={initialValues?.postalCode} />
      <Field name="country" label="Country" defaultValue={initialValues?.country ?? "India"} />
      <label className="flex items-center gap-2 text-sm text-ink-mute sm:col-span-2">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={initialValues?.isDefault}
          className="rounded border-ink/20"
        />
        Set as default
      </label>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "edit" ? "Update address" : "Save address"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 text-sm text-ink-mute underline-offset-4 hover:underline"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  defaultValue,
  className
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <label className={className ?? ""}>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</span>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
      />
    </label>
  );
}
