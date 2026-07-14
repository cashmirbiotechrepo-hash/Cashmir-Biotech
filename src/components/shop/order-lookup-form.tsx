"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderLookupForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<"request" | "otp">("request");
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const nextEmail = String(fd.get("email") ?? "");
    const nextOrder = String(fd.get("orderNumber") ?? "");
    try {
      const res = await fetch("/api/order/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, orderNumber: nextOrder, step: "request" })
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        step?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Could not look up that order.");
        return;
      }
      setEmail(nextEmail);
      setOrderNumber(nextOrder);
      setStep("otp");
      setMessage(json.message ?? "Check your email for a 6-digit code.");
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/order/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          orderNumber,
          code: fd.get("code"),
          step: "verify"
        })
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      } | null;
      if (!res.ok || !json?.ok || !json.redirectTo) {
        setError(json?.error ?? "Invalid or expired code.");
        return;
      }
      router.push(json.redirectTo);
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  if (step === "otp") {
    return (
      <form onSubmit={verifyCode} className="mx-auto max-w-md space-y-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="rounded-xl border border-ink/10 bg-pearl/50 px-3 py-2 text-sm text-ink-mute">
            {message}
          </p>
        ) : null}
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">6-digit code</span>
          <input
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm tracking-[0.3em] outline-none ring-gold/30 focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper disabled:opacity-60"
        >
          {pending ? "Verifying…" : "Open order"}
        </button>
        <button
          type="button"
          className="w-full font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
          onClick={() => {
            setStep("request");
            setMessage(null);
            setError(null);
          }}
        >
          Start over
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="mx-auto max-w-md space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Email used at checkout</span>
        <input
          name="email"
          type="email"
          required
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Order number</span>
        <input
          name="orderNumber"
          required
          placeholder="CB-…"
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-ivory px-3 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send one-time code"}
      </button>
    </form>
  );
}
