"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

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

  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sent) {
      codeRef.current?.focus();
      return;
    }
    emailRef.current?.focus();
  }, [sent]);

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
      const dest =
        next.startsWith("/portal") && !next.startsWith("//") && !next.includes("\\")
          ? next
          : "/portal";
      router.push(dest);
      router.refresh();
    });
  }

  const canSend = email.includes("@") && email.includes(".");
  const canVerify = code.length === 6;

  return (
    <div className="w-full border border-ink/10 bg-paper px-5 py-6 sm:px-6 sm:py-7">
      <ol className="flex items-center gap-2 text-[12px] text-ink-mute" aria-label="Sign-in steps">
        <li className={cn("font-medium", !sent ? "text-ink" : "text-ink-mute")}>
          <span className={cn("mr-1.5 tabular-nums", !sent ? "text-gold" : "text-ink-faint")}>1</span>
          Email
        </li>
        <li aria-hidden className="text-ink/20">
          →
        </li>
        <li className={cn("font-medium", sent ? "text-ink" : "text-ink-faint")}>
          <span className={cn("mr-1.5 tabular-nums", sent ? "text-gold" : "text-ink-faint")}>2</span>
          Verify
        </li>
      </ol>

      {!sent ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend && !pending) requestCode();
          }}
        >
          <label className="block">
            <span className="text-[13px] font-medium text-ink">Checkout email</span>
            <input
              ref={emailRef}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3.5 text-[16px] text-ink outline-none ring-gold/35 transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2"
              placeholder="you@example.com"
              required
            />
          </label>

          <button
            type="submit"
            disabled={pending || !canSend}
            className={cn(
              "w-full py-3.5 text-[15px] font-medium transition-[transform,opacity,background-color]",
              canSend && !pending
                ? "bg-ink text-paper hover:-translate-y-px"
                : "cursor-not-allowed bg-ink/25 text-paper"
            )}
          >
            {pending ? "Sending…" : "Continue"}
          </button>

          <p className="text-[13px] leading-snug text-ink-mute">
            We&apos;ll email a secure one-time login code.
          </p>
        </form>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canVerify && !pending) verifyCode();
          }}
        >
          <p className="text-[14px] text-ink-mute">
            Code sent to <span className="font-medium text-ink">{email}</span>
          </p>

          <label className="block">
            <span className="text-[13px] font-medium text-ink">One-time code</span>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3.5 text-center font-mono text-[1.35rem] tracking-[0.35em] text-ink outline-none ring-gold/35 transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2"
              placeholder="······"
              required
            />
          </label>

          <button
            type="submit"
            disabled={pending || !canVerify}
            className={cn(
              "w-full py-3.5 text-[15px] font-medium transition-[transform,opacity,background-color]",
              canVerify && !pending
                ? "bg-ink text-paper hover:-translate-y-px"
                : "cursor-not-allowed bg-ink/25 text-paper"
            )}
          >
            {pending ? "Verifying…" : "Open my account"}
          </button>

          <p className="text-[13px] text-ink-mute">Code expires in 10 minutes.</p>

          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={requestCode}
              className="inline-flex min-h-11 items-center justify-center text-[13px] text-ink-soft hover:text-ink disabled:opacity-50"
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
              className="inline-flex min-h-11 items-center justify-center text-[13px] text-ink-soft hover:text-ink"
            >
              Use a different email
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p className="mt-4 text-[13px] text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {info && !error && sent ? (
        <p className="sr-only" role="status">
          {info}
        </p>
      ) : null}
    </div>
  );
}
