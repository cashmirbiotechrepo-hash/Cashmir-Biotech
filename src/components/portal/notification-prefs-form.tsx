"use client";

import { useActionState } from "react";
import {
  updateNotificationPrefsAction,
  type PortalProfileState
} from "@/app/(portal)/portal/(session)/actions";
import { usePortalActionToast } from "@/components/portal/use-portal-action-toast";

const initial: PortalProfileState = {};

export function NotificationPrefsForm({
  notifyOrderUpdates,
  notifyMarketing
}: {
  notifyOrderUpdates: boolean;
  notifyMarketing: boolean;
}) {
  const [state, action, pending] = useActionState(updateNotificationPrefsAction, initial);
  usePortalActionToast(state, { success: "Email preferences saved." });

  return (
    <form action={action} className="space-y-3 border border-ink/10 bg-paper p-4">
      <h2 className="text-[14px] font-medium text-ink">Email preferences</h2>
      {state.error ? (
        <p role="alert" className="text-[13px] text-red-700">
          {state.error}
        </p>
      ) : null}
      <label className="flex items-start gap-2.5 text-[13px] text-ink">
        <input
          type="checkbox"
          name="notifyOrderUpdates"
          defaultChecked={notifyOrderUpdates}
          className="mt-0.5 rounded border-ink/20"
        />
        <span>
          Order updates
          <span className="mt-0.5 block text-[12px] text-ink-mute">
            Confirmation and shipping emails for your purchases.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-[13px] text-ink">
        <input
          type="checkbox"
          name="notifyMarketing"
          defaultChecked={notifyMarketing}
          className="mt-0.5 rounded border-ink/20"
        />
        <span>
          Research & offers
          <span className="mt-0.5 block text-[12px] text-ink-mute">
            Occasional Circle and catalog campaigns (optional). Opt out anytime.
          </span>
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
