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
  sessionExpired
}: {
  next: string;
  rateLimited: boolean;
  sessionExpired?: boolean;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [savedCreds, setSavedCreds] = useState({ email: "", password: "" });
  const [powFields, setPowFields] = useState<(PoWChallenge & { nonce: number }) | null>(null);
  const [error, setError] = useState<string | undefined>(
    rateLimited
      ? "Too many attempts. Please wait a minute and try again."
      : sessionExpired
        ? "Your session expired. Sign in again to continue."
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
      } else if (powFields) {
        fd.set("powChallenge", powFields.challenge);
        fd.set("powNonce", String(powFields.nonce));
        fd.set("powTimestamp", String(powFields.timestamp));
        fd.set("powSignature", powFields.signature);
        fd.set("powDifficulty", String(powFields.difficulty));
      }

      const result = await loginAction(fd);
      if (result?.requireTwoFactor) {
        setSavedCreds({
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? "")
        });
        setTwoFactor(true);
        return;
      }
      if (result?.error) setError(result.error);
    } catch {
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
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          {twoFactor ? (
            <>
              <input type="hidden" name="email" value={savedCreds.email} />
              <input type="hidden" name="password" value={savedCreds.password} />
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
                    fd.set("email", savedCreds.email);
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
