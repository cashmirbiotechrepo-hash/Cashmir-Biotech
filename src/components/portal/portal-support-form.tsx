"use client";

import { useActionState } from "react";
import { createSupportTicket, type PortalAddressState } from "@/app/(portal)/portal/(session)/actions";

const initial: PortalAddressState = {};

export function PortalSupportForm({
  orderOptions
}: {
  orderOptions: Array<{ orderNumber: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(createSupportTicket, initial);

  return (
    <form action={formAction} className="space-y-3 border border-ink/10 bg-paper p-4">
      {state.error ? (
        <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-[13px] text-ink-mute">
          Ticket submitted — we&apos;ll reply by email.
        </p>
      ) : null}

      <label className="block">
        <span className="text-[13px] font-medium text-ink">Topic</span>
        <select
          name="topic"
          required
          className="mt-1.5 w-full border border-ink/12 bg-ivory px-3 py-2.5 text-[16px] text-ink outline-none focus:border-ink/25"
          defaultValue="question"
        >
          <option value="shipment">Shipment</option>
          <option value="refund">Refund</option>
          <option value="quality">Quality</option>
          <option value="question">General question</option>
        </select>
      </label>

      <label className="block">
        <span className="text-[13px] font-medium text-ink">Order (optional)</span>
        <select
          name="orderNumber"
          className="mt-1.5 w-full border border-ink/12 bg-ivory px-3 py-2.5 text-[16px] text-ink outline-none focus:border-ink/25"
          defaultValue=""
        >
          <option value="">No specific order</option>
          {orderOptions.map((o) => (
            <option key={o.orderNumber} value={o.orderNumber}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[13px] font-medium text-ink">Subject</span>
        <input
          name="subject"
          required
          placeholder="e.g. Tracking for my latest order"
          className="mt-1.5 w-full border border-ink/12 bg-ivory px-3 py-2.5 text-[16px] text-ink outline-none ring-gold/30 focus:ring-2"
        />
      </label>

      <label className="block">
        <span className="text-[13px] font-medium text-ink">Message</span>
        <textarea
          name="body"
          required
          minLength={10}
          rows={4}
          placeholder="Describe what you need help with…"
          className="mt-1.5 w-full border border-ink/12 bg-ivory px-3 py-2.5 text-[16px] text-ink outline-none ring-gold/30 focus:ring-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-11 bg-ink text-[15px] font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit ticket"}
      </button>
    </form>
  );
}
