"use client";

import { useActionState } from "react";
import { createSupportTicket, type PortalAddressState } from "@/app/(portal)/portal/(session)/actions";

const initial: PortalAddressState = {};

const TOPICS = [
  { value: "coa_request", label: "Certificate of Analysis (CoA)" },
  { value: "cancel_order", label: "Cancel order request" },
  { value: "return_request", label: "Return request" },
  { value: "shipment", label: "Shipment" },
  { value: "refund", label: "Refund" },
  { value: "quality", label: "Quality" },
  { value: "question", label: "General question" }
] as const;

function defaultsForIntent(intent?: string) {
  if (intent === "cancel") {
    return {
      topic: "cancel_order",
      subject: "Cancel order request",
      body: "Please cancel this order if it has not shipped yet. Thank you."
    };
  }
  if (intent === "return") {
    return {
      topic: "return_request",
      subject: "Return request",
      body: "I would like to return item(s) from this order. Reason: "
    };
  }
  if (intent === "coa") {
    return {
      topic: "coa_request",
      subject: "CoA request",
      body: "Please share the Certificate of Analysis for the lot(s) on this order."
    };
  }
  return { topic: "question", subject: "", body: "" };
}

export function PortalSupportForm({
  orderOptions,
  presetOrderNumber = "",
  intent
}: {
  orderOptions: Array<{ orderNumber: string; label: string }>;
  presetOrderNumber?: string;
  intent?: string;
}) {
  const [state, formAction, pending] = useActionState(createSupportTicket, initial);
  const defaults = defaultsForIntent(intent);

  return (
    <form action={formAction} className="space-y-3 border border-ink/10 bg-paper p-4">
      {intent === "cancel" || intent === "return" ? (
        <p className="text-[13px] text-ink-mute">
          This submits a <strong className="font-medium text-ink">request</strong> to our team — it does
          not change the order status automatically.
        </p>
      ) : null}

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
          defaultValue={defaults.topic}
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[13px] font-medium text-ink">Order (optional)</span>
        <select
          name="orderNumber"
          className="mt-1.5 w-full border border-ink/12 bg-ivory px-3 py-2.5 text-[16px] text-ink outline-none focus:border-ink/25"
          defaultValue={presetOrderNumber}
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
          defaultValue={defaults.subject}
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
          defaultValue={defaults.body}
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
