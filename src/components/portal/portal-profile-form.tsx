"use client";

import { useActionState } from "react";
import {
  updateCustomerProfileAction,
  type PortalProfileState
} from "@/app/(portal)/portal/(session)/actions";
import { usePortalActionToast } from "@/components/portal/use-portal-action-toast";

const initial: PortalProfileState = {};

export function PortalProfileForm({
  name,
  phone
}: {
  name: string | null;
  phone: string | null;
}) {
  const [state, action, pending] = useActionState(updateCustomerProfileAction, initial);
  usePortalActionToast(state, { success: "Profile updated." });

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" noValidate>
      {state.error ? (
        <p
          role="alert"
          className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}
      <label>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Full name</span>
        <input
          name="name"
          required
          defaultValue={name ?? ""}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
        />
      </label>
      <label>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Mobile (India)
        </span>
        <input
          name="phone"
          required
          inputMode="tel"
          defaultValue={phone ?? ""}
          placeholder="10-digit mobile"
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="sm:col-span-2 mt-1 rounded-full bg-ink py-3 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
