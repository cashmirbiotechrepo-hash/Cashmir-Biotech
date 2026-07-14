"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function PortalLoginForm({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">(initialEmail ? "email" : "email");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestCode() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch("/api/portal/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not send code.");
        return;
      }
      setSent(true);
      setStep("code");
      setInfo(data.message ?? "Check your inbox for a 6-digit code.");
    });
  }

  function verifyCode() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/portal/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Invalid code.");
        return;
      }
      router.push(next.startsWith("/") ? next : "/portal");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">Cashmir Biotech</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight text-ink md:text-4xl">Research Portal</h1>
        <p className="mt-3 text-sm text-ink-mute">
          Enter the email from your order. We&apos;ll send a one-time code — no password required.
        </p>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-paper/80 p-7 shadow-glass md:p-8">
        {step === "email" || !sent ? (
          <div className="space-y-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-ink/15 bg-ivory px-4 py-3 text-sm text-ink outline-none ring-gold/40 focus:ring-2"
                placeholder="you@lab.org"
              />
            </label>
            <button
              type="button"
              disabled={pending || !email.includes("@")}
              onClick={requestCode}
              className="w-full rounded-full bg-ink py-3.5 text-sm font-medium text-paper disabled:opacity-40"
            >
              {pending ? "Sending…" : "Continue"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-mute">
              Code sent to <span className="text-ink">{email}</span>
            </p>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">One-time code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 w-full rounded-xl border border-ink/15 bg-ivory px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-ink outline-none ring-gold/40 focus:ring-2"
                placeholder="······"
              />
            </label>
            <button
              type="button"
              disabled={pending || code.length !== 6}
              onClick={verifyCode}
              className="w-full rounded-full bg-ink py-3.5 text-sm font-medium text-paper disabled:opacity-40"
            >
              {pending ? "Verifying…" : "Enter portal"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={requestCode}
              className="w-full text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode("");
                setStep("email");
                setInfo(null);
              }}
              className="w-full text-center text-xs text-ink-mute hover:text-ink"
            >
              Use a different email
            </button>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {info && !error ? <p className="mt-4 text-sm text-ink-mute">{info}</p> : null}
      </div>
    </div>
  );
}
