"use client";

import { useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { loginAction, resendTwoFactorAction } from "./actions";
import { solvePoWChallenge } from "@/lib/admin/pow-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function LoginForm({ next, rateLimited }: { next: string; rateLimited: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [savedCreds, setSavedCreds] = useState({ email: "", password: "" });
  const [powFields, setPowFields] = useState<PoWChallenge & { nonce: number } | null>(null);
  const [error, setError] = useState<string | undefined>(
    rateLimited ? "Too many attempts. Please wait a minute and try again." : undefined
  );

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
      setError("Security verification failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{twoFactor ? "Verify sign-in" : "Sign in"}</CardTitle>
        <CardDescription>
          {twoFactor
            ? "Enter the 6-digit code sent to your email. In development, check the server console."
            : "Use your credentials to access the operations console."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          <input type="hidden" name="next" value={next} />
          {twoFactor ? (
            <>
              <input type="hidden" name="email" value={savedCreds.email} />
              <input type="hidden" name="password" value={savedCreds.password} />
            </>
          ) : null}

          {!twoFactor ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@cashmirbiotech.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="twoFactorCode">Verification code</Label>
              <Input
                id="twoFactorCode"
                name="twoFactorCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="000000"
                className="text-center text-lg tracking-[0.3em]"
              />
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? (twoFactor ? "Verifying…" : "Verifying security…") : twoFactor ? "Confirm code" : "Sign in"}
          </Button>

          {twoFactor ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(undefined);
                try {
                  const fd = new FormData();
                  fd.set("email", savedCreds.email);
                  const result = await resendTwoFactorAction(fd);
                  if (result?.error) setError(result.error);
                  else setError("A new code was sent. Check your email (or server console in dev).");
                } catch {
                  setError("Could not resend code.");
                } finally {
                  setPending(false);
                }
              }}
            >
              Resend code
            </Button>
          ) : null}

          {twoFactor ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setTwoFactor(false);
                setPowFields(null);
                setError(undefined);
              }}
            >
              Back to sign in
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
