"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

export function PortalLoginForm({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
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
      setInfo(data.message ?? "Check your inbox for a 6-digit code. It expires in 10 minutes.");
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
    <div className="w-full max-w-md border border-ink/12 bg-paper/90 p-7 shadow-glass md:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Password-free login</p>
      <h2 className="mt-2 text-xl font-light tracking-tight text-ink md:text-2xl">
        {sent ? "Enter your secure code" : "Sign in with email"}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">
        {sent
          ? "We emailed a one-time code. It takes about 30 seconds — no password to remember."
          : "We’ll send a one-time login code. Secure, expires in 10 minutes."}
      </p>

      {!sent ? (
        <div className="mt-7 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Checkout email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3 text-sm text-ink outline-none ring-gold/40 focus:ring-2"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="button"
            disabled={pending || !email.includes("@")}
            onClick={requestCode}
            className="w-full bg-ink py-3.5 text-sm font-medium text-paper transition-opacity disabled:opacity-40"
          >
            {pending ? "Sending…" : "Send login code"}
          </button>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          <p className="text-sm text-ink-mute">
            Code sent to <span className="text-ink">{email}</span>
          </p>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              One-time code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-ink outline-none ring-gold/40 focus:ring-2"
              placeholder="······"
            />
          </label>
          <button
            type="button"
            disabled={pending || code.length !== 6}
            onClick={verifyCode}
            className="w-full bg-ink py-3.5 text-sm font-medium text-paper disabled:opacity-40"
          >
            {pending ? "Verifying…" : "Open my account"}
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
              setInfo(null);
              setError(null);
            }}
            className="w-full text-center text-xs text-ink-mute hover:text-ink"
          >
            Use a different email
          </button>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {info && !error ? <p className="mt-4 text-sm text-ink-mute">{info}</p> : null}

      <ul className="mt-7 space-y-1.5 border-t border-ink/8 pt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        <li>Secure login · no password stored</li>
        <li>OTP expires in 10 minutes</li>
        <li>Session cookies encrypted</li>
      </ul>

      <div className="mt-6 space-y-2 border-t border-ink/8 pt-5 text-[12px] text-ink-mute">
        <p className="font-medium text-ink-soft">No account yet?</p>
        <p>
          If you&apos;ve placed an order, we create your customer account when the email is verified — nothing extra
          to set up.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        <Link href="/contact" className="hover:text-ink">
          Contact support
        </Link>
        <Link href="/order/lookup" className="hover:text-ink">
          Find an order
        </Link>
        <Link href="/contact" className="hover:text-ink">
          Institution enquiries
        </Link>
        <Link href="/products" className="hover:text-ink">
          Back to store
        </Link>
      </div>
    </div>
  );
}
