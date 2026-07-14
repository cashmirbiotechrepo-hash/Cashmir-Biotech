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
    <form action={formAction} className="max-w-xl space-y-3 rounded-2xl border border-ink/10 bg-paper/60 p-5">
      {state.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-ink-mute">
          Ticket submitted — we&apos;ll reply by email.
        </p>
      ) : null}
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Topic</span>
        <select
          name="topic"
          required
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm"
          defaultValue="question"
        >
          <option value="shipment">Shipment</option>
          <option value="refund">Refund</option>
          <option value="quality">Quality</option>
          <option value="question">General question</option>
        </select>
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Order (optional)</span>
        <select name="orderNumber" className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm" defaultValue="">
          <option value="">No specific order</option>
          {orderOptions.map((o) => (
            <option key={o.orderNumber} value={o.orderNumber}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Subject</span>
        <input
          name="subject"
          required
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Message</span>
        <textarea
          name="body"
          required
          minLength={10}
          rows={5}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit ticket"}
      </button>
    </form>
  );
}
