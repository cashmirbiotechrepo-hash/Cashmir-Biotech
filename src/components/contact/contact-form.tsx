"use client";

import { useState } from "react";

export function ContactForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone") || "",
          company: fd.get("company") || "",
          message: fd.get("message")
        })
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Could not send message.");
        return;
      }
      setDone(true);
      e.currentTarget.reset();
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-2xl border border-ink/10 bg-paper/70 p-8 text-sm text-ink-mute">
        Thanks — we received your message and will respond by email.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-ink/10 bg-paper/70 p-8 shadow-glass"
      noValidate
    >
      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <Field name="name" label="Name" required />
      <Field name="email" label="Email" type="email" required />
      <Field name="phone" label="Phone" />
      <Field name="company" label="Organisation" />
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Message</span>
        <textarea
          name="message"
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
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
      />
    </label>
  );
}
