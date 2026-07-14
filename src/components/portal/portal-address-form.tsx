"use client";

import { useActionState } from "react";
import { savePortalAddress, type PortalAddressState } from "@/app/(portal)/portal/(session)/actions";

const initial: PortalAddressState = {};

export function PortalAddressForm() {
  const [state, action, pending] = useActionState(savePortalAddress, initial);

  return (
    <form action={action} className="grid max-w-xl gap-3 sm:grid-cols-2" noValidate>
      {state.error ? (
        <p role="alert" className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="sm:col-span-2 text-sm text-ink-mute">
          Address saved.
        </p>
      ) : null}
      <Field name="label" label="Label" defaultValue="Home" />
      <Field name="fullName" label="Full name" required />
      <Field name="phone" label="Phone" required className="sm:col-span-2" />
      <Field name="line1" label="Address line 1" required className="sm:col-span-2" />
      <Field name="line2" label="Address line 2" className="sm:col-span-2" />
      <Field name="city" label="City" required />
      <Field name="state" label="State" required />
      <Field name="postalCode" label="PIN" required />
      <Field name="country" label="Country" defaultValue="India" />
      <label className="flex items-center gap-2 sm:col-span-2 text-sm text-ink-mute">
        <input type="checkbox" name="isDefault" className="rounded border-ink/20" />
        Set as default
      </label>
      <button
        type="submit"
        disabled={pending}
        className="sm:col-span-2 mt-2 rounded-full bg-ink py-3 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save address"}
      </button>
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
