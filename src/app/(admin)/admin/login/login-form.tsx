"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginAction, resendTwoFactorAction } from "./actions";
import { solvePoWChallenge } from "@/lib/admin/pow-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PoWChallenge = {
  challenge: string;
  timestamp: number;
  signature: string;
  difficulty: number;
};

async function fetchPoWChallenge(): Promise<PoWChallenge> {
  const res = await fetch("/api/admin/auth/pow-challenge", { cache: "no-store" });
  if (!res.ok) throw new Error("challenge");
  return res.json();
}

export function LoginForm({
  next,
  rateLimited,
  sessionExpired,
  oauthError
}: {
  next: string;
  rateLimited: boolean;
  sessionExpired?: boolean;
  oauthError?: string;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [savedContext, setSavedContext] = useState({ email: "", token: "" });
  const [powFields, setPowFields] = useState<(PoWChallenge & { nonce: number }) | null>(null);
  const [error, setError] = useState<string | undefined>(
    rateLimited
      ? "Too many attempts. Please wait a minute and try again."
      : sessionExpired
        ? "Your session expired. Sign in again to continue."
        : oauthError
          ? resolveOAuthError(oauthError)
          : undefined
  );

  useEffect(() => {
    if (!twoFactor) emailRef.current?.focus();
  }, [twoFactor]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const fd = new FormData(event.currentTarget);

      if (!twoFactor) {
        const challenge = await fetchPoWChallenge();
        const nonce = await solvePoWChallenge(challenge.challenge, challenge.difficulty);
        fd.set("powChallenge", challenge.challenge);
        fd.set("powNonce", String(nonce));
        fd.set("powTimestamp", String(challenge.timestamp));
        fd.set("powSignature", challenge.signature);
        fd.set("powDifficulty", String(challenge.difficulty));
        setPowFields({ ...challenge, nonce });
      }

      const result = await loginAction(fd);
      if (result?.ok && result.next) {
        window.location.assign(result.next);
        return;
      }
      if (result?.requireTwoFactor) {
        setSavedContext({
          email: String(fd.get("email") ?? ""),
          token: result.token ?? ""
        });
        setTwoFactor(true);
        return;
      }
      if (result?.error) setError(result.error);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Successful redirect() from an older build, or stale Server Action id after deploy
      if (
        (typeof err === "object" &&
          err !== null &&
          "digest" in err &&
          String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) ||
        /NEXT_REDIRECT/i.test(msg)
      ) {
        window.location.assign("/admin/dashboard");
        return;
      }
      if (/Failed to find Server Action|server action/i.test(msg)) {
        setError("This page is out of date after a deploy. Refreshing…");
        window.location.reload();
        return;
      }
      setError("Could not complete sign-in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-border bg-card">
      <div className="h-px bg-[#b89458]" aria-hidden />

      <div className="px-7 pt-7 pb-1 sm:px-8 sm:pt-8">
        <h2 className="text-xl font-medium tracking-tight text-foreground sm:text-[22px]">
          {twoFactor ? "Verify identity" : "Sign in to Operations"}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {twoFactor
            ? "Enter the 6-digit code sent to your email."
            : "Restricted access for authorized Cashmir Biotech personnel."}
        </p>
      </div>

      <div className="px-7 pb-7 pt-5 sm:px-8 sm:pb-8">
        {/* Google Sign-In (only shown on the main login step, not 2FA) */}
        {!twoFactor ? (
          <div className="mb-5 space-y-3">
            <a
              id="admin-google-signin-btn"
              href="/api/admin/auth/google"
              className="flex w-full items-center justify-center gap-3 border border-border bg-muted/40 px-4 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </a>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" aria-hidden />
              <span className="text-[11px] text-muted-foreground">or use password</span>
              <div className="h-px flex-1 bg-border" aria-hidden />
            </div>
          </div>
        ) : null}

        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          {twoFactor ? (
            <>
              <input type="hidden" name="email" value={savedContext.email} />
              <input type="hidden" name="twoFactorToken" value={savedContext.token} />
            </>
          ) : null}

          {!twoFactor ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px]">
                  Email
                </Label>
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                  autoFocus
                  placeholder="you@cashmirbiotech.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px]">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 pr-11"
                    onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                    onKeyDown={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {capsLock ? (
                  <p className="text-[12px] text-amber-700" role="status">
                    Caps Lock is on
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="twoFactorCode" className="text-[13px]">
                Verification code
              </Label>
              <Input
                id="twoFactorCode"
                name="twoFactorCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="000000"
                className="h-11 text-center text-lg tracking-[0.3em]"
              />
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <Button type="submit" disabled={pending} size="lg" className="h-11 w-full">
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {twoFactor ? "Verifying…" : "Signing in…"}
              </span>
            ) : twoFactor ? (
              "Confirm code"
            ) : (
              "Sign in"
            )}
          </Button>

          {twoFactor ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError(undefined);
                  try {
                    const fd = new FormData();
                    fd.set("email", savedContext.email);
                    const result = await resendTwoFactorAction(fd);
                    if (result?.error) setError(result.error);
                    else setError("A new code was sent to your email.");
                  } catch {
                    setError("Could not resend code.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Resend code
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 flex-1"
                onClick={() => {
                  setTwoFactor(false);
                  setPowFields(null);
                  setError(undefined);
                }}
              >
                Back
              </Button>
            </div>
          ) : null}
        </form>

        {!twoFactor ? (
          <p className="mt-5 border-t border-border pt-4 text-[12px] leading-relaxed text-muted-foreground">
            Access is managed internally. For account provisioning contact{" "}
            <Link href="/contact" className="text-foreground underline-offset-4 hover:underline">
              Cashmir Biotech IT
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}

function resolveOAuthError(error: string): string {
  const messages: Record<string, string> = {
    no_admin_account: "No admin account found for this Google account. Contact IT to link your account.",
    oauth_denied: "Google sign-in was cancelled.",
    oauth_state_mismatch: "Sign-in failed (security check). Please try again.",
    oauth_token_failed: "Could not complete Google sign-in. Please try again.",
    oauth_userinfo_failed: "Could not retrieve your Google account details.",
    account_inactive: "This admin account has been deactivated.",
    oauth_server_error: "An error occurred. Please try again.",
    oauth_not_configured: "Google sign-in is not available right now."
  };
  return messages[error] ?? "Sign-in failed. Please try again.";
}
