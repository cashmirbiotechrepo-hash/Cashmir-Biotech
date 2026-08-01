"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

type LoginView = "choose" | "otp-email" | "otp-verify" | "reset-request" | "reset-verify";

export function PortalLoginForm({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";
  const errorParam = searchParams.get("error");
  const rateLimitedParam = searchParams.get("rateLimited");

  const [view, setView] = useState<LoginView>("choose");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(
    rateLimitedParam === "1" ? "Too many attempts. Please try again later." : oauthErrorMessage(errorParam)
  );
  const [info, setInfo] = useState<string | null>(null);
  
  const [googlePending, startGoogleTransition] = useTransition();
  const [formPending, startFormTransition] = useTransition();

  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === "otp-verify" || view === "reset-verify") codeRef.current?.focus();
    else if (view === "otp-email" || view === "reset-request") emailRef.current?.focus();
  }, [view]);

  function getDest() {
    return next.startsWith("/portal") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/portal";
  }

  function handleGoogleSignIn() {
    startGoogleTransition(() => {
      window.location.href = `/api/portal/auth/google?next=${encodeURIComponent(getDest())}`;
    });
  }

  function loginWithPassword() {
    setError(null);
    startFormTransition(async () => {
      const res = await fetch("/api/portal/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Invalid email or password.");
        return;
      }
      router.push(getDest());
      router.refresh();
    });
  }

  function requestOtpCode(purpose: "login" | "password_reset") {
    setError(null);
    setInfo(null);
    startFormTransition(async () => {
      const endpoint = purpose === "password_reset" 
        ? "/api/portal/auth/password/reset/request"
        : "/api/portal/auth/otp/request";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not send code.");
        return;
      }
      setView(purpose === "password_reset" ? "reset-verify" : "otp-verify");
      setInfo(data.message ?? "Check your inbox for a 6-digit code.");
    });
  }

  function verifyOtpCode() {
    setError(null);
    startFormTransition(async () => {
      const res = await fetch("/api/portal/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Invalid code.");
        return;
      }
      router.push(getDest());
      router.refresh();
    });
  }

  function verifyResetCode() {
    setError(null);
    startFormTransition(async () => {
      const res = await fetch("/api/portal/auth/password/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Invalid code or password.");
        return;
      }
      // Reset success! Go back to choose view so they can login with new password.
      setInfo("Password reset successfully. You can now log in.");
      setView("choose");
      setPassword("");
      setCode("");
      setNewPassword("");
    });
  }

  const isPending = googlePending || formPending;

  // ── Choose view (landing) ──────────────────────────────────────────────────
  if (view === "choose") {
    const canLogin = email.includes("@") && email.includes(".") && password.length > 0;
    return (
      <div className="w-full border border-ink/10 bg-paper px-5 py-6 sm:px-6 sm:py-7 space-y-5">
        
        {info ? (
          <p className="text-[13px] text-green-700 bg-green-50 p-3 border border-green-200" role="status">
            {info}
          </p>
        ) : null}

        {/* Google */}
        <button
          id="google-signin-btn"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isPending}
          className={cn(
            "relative flex w-full items-center justify-center gap-3 border border-ink/15 bg-ivory px-4 py-3.5 text-[15px] font-medium text-ink transition-[background-color,opacity,transform]",
            "hover:bg-ink/5 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2",
            isPending && "cursor-not-allowed opacity-50"
          )}
        >
          {googlePending ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden />
          ) : (
            <GoogleIcon className="h-5 w-5 shrink-0" />
          )}
          {googlePending ? "Redirecting…" : "Continue with Google"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-ink/10" aria-hidden />
          <span className="text-[12px] text-ink-faint">or</span>
          <div className="h-px flex-1 bg-ink/10" aria-hidden />
        </div>

        {/* Password Form */}
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (canLogin && !isPending) loginWithPassword(); }}
        >
          <label className="block">
            <span className="text-[13px] font-medium text-ink">Email</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3 text-[15px] text-ink outline-none ring-gold/35 transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2"
              placeholder="you@example.com"
              required
            />
          </label>
          <div className="block space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">Password</span>
              <button
                type="button"
                onClick={() => { setView("reset-request"); setError(null); setInfo(null); }}
                className="text-[12px] text-ink-soft hover:text-ink hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink/15 bg-ivory px-4 py-3 text-[15px] text-ink outline-none ring-gold/35 transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isPending || !canLogin}
            className={cn(
              "w-full py-3 text-[15px] font-medium transition-[transform,opacity,background-color]",
              canLogin && !isPending
                ? "bg-ink text-paper hover:-translate-y-px"
                : "cursor-not-allowed bg-ink/25 text-paper"
            )}
          >
            {formPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-ink/10" aria-hidden />
          <span className="text-[12px] text-ink-faint">or</span>
          <div className="h-px flex-1 bg-ink/10" aria-hidden />
        </div>

        {/* OTP option */}
        <button
          id="otp-signin-btn"
          type="button"
          onClick={() => {
            setError(null);
            setInfo(null);
            setView("otp-email");
          }}
          disabled={isPending}
          className={cn(
            "w-full border border-ink/10 py-3 text-[14px] text-ink-soft transition-[background-color,color,transform]",
            "hover:bg-ink/5 hover:text-ink hover:-translate-y-px",
            isPending && "cursor-not-allowed opacity-50"
          )}
        >
          Use a one-time email code instead
        </button>

        {error ? (
          <p className="text-[13px] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // ── OTP & Reset Request Views ───────────────────────────────────────────────
  if (view === "otp-email" || view === "reset-request") {
    const isReset = view === "reset-request";
    const canSend = email.includes("@") && email.includes(".");

    return (
      <div className="w-full border border-ink/10 bg-paper px-5 py-6 sm:px-6 sm:py-7">
        <button
          type="button"
          onClick={() => { setView("choose"); setError(null); }}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-mute hover:text-ink"
        >
          <span aria-hidden>←</span> Back
        </button>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (canSend && !isPending) requestOtpCode(isReset ? "password_reset" : "login"); }}
        >
          <h2 className="text-[18px] font-medium text-ink">
            {isReset ? "Reset password" : "Login with code"}
          </h2>
          <label className="block">
            <span className="text-[13px] font-medium text-ink">Checkout email</span>
            <input
              ref={emailRef}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3 text-[15px] text-ink outline-none ring-gold/35 transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2"
              placeholder="you@example.com"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isPending || !canSend}
            className={cn(
              "w-full py-3 text-[15px] font-medium transition-[transform,opacity,background-color]",
              canSend && !isPending
                ? "bg-ink text-paper hover:-translate-y-px"
                : "cursor-not-allowed bg-ink/25 text-paper"
            )}
          >
            {formPending ? "Sending…" : "Send code"}
          </button>

          <p className="text-[13px] leading-snug text-ink-mute">
            We&apos;ll email a secure one-time code.
          </p>
        </form>

        {error ? (
          <p className="mt-4 text-[13px] text-red-700" role="alert">{error}</p>
        ) : null}
      </div>
    );
  }

  // ── OTP & Reset Verify Views ───────────────────────────────────────────────
  const isResetVerify = view === "reset-verify";
  const canVerify = code.length === 6 && (!isResetVerify || newPassword.length >= 8);

  return (
    <div className="w-full border border-ink/10 bg-paper px-5 py-6 sm:px-6 sm:py-7">
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); if (canVerify && !isPending) isResetVerify ? verifyResetCode() : verifyOtpCode(); }}
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
            className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3 text-center font-mono text-[1.35rem] tracking-[0.35em] text-ink outline-none ring-gold/35 transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2"
            placeholder="······"
            required
          />
        </label>

        {isResetVerify ? (
          <label className="block">
            <span className="text-[13px] font-medium text-ink">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2 w-full border border-ink/15 bg-ivory px-4 py-3 text-[15px] text-ink outline-none ring-gold/35 transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2"
              placeholder="Min 8 characters"
              required
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={isPending || !canVerify}
          className={cn(
            "w-full py-3 text-[15px] font-medium transition-[transform,opacity,background-color]",
            canVerify && !isPending
              ? "bg-ink text-paper hover:-translate-y-px"
              : "cursor-not-allowed bg-ink/25 text-paper"
          )}
        >
          {formPending ? "Verifying…" : isResetVerify ? "Reset password" : "Open my account"}
        </button>

        <p className="text-[13px] text-ink-mute">Code expires in 10 minutes.</p>

        <div className="flex flex-col gap-1 pt-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => requestOtpCode(isResetVerify ? "password_reset" : "login")}
            className="inline-flex min-h-11 items-center justify-center text-[13px] text-ink-soft hover:text-ink disabled:opacity-50"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={() => { 
              setView(isResetVerify ? "reset-request" : "otp-email"); 
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

      {error ? (
        <p className="mt-4 text-[13px] text-red-700" role="alert">{error}</p>
      ) : null}
      {info && !error ? (
        <p className="sr-only" role="status">{info}</p>
      ) : null}
    </div>
  );
}

function oauthErrorMessage(error: string | null): string | null {
  if (!error) return null;
  const messages: Record<string, string> = {
    oauth_denied: "Sign-in was cancelled.",
    oauth_state_mismatch: "Sign-in failed (security check). Please try again.",
    oauth_token_failed: "Could not complete Google sign-in. Please try again.",
    oauth_userinfo_failed: "Could not retrieve your Google account details.",
    oauth_unverified_email: "Your Google account email is not verified.",
    account_inactive: "This account has been deactivated. Contact support.",
    oauth_server_error: "An error occurred. Please try again.",
    oauth_not_configured: "Google sign-in is not available right now."
  };
  return messages[error] ?? "Sign-in failed. Please try again.";
}
