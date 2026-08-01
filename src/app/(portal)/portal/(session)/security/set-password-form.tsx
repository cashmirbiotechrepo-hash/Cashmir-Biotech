"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function SetPasswordForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-[13px] font-medium text-ink underline-offset-4 hover:underline"
      >
        Set a password
      </button>
    );
  }

  const canSubmit = password.length >= 8 && password === confirm;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/portal/auth/password/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword: confirm })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to set password");
        return;
      }
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 max-w-sm space-y-4 rounded-xl border border-ink/10 bg-ivory p-4 sm:p-5">
      <h3 className="text-[14px] font-medium text-ink">Set a password</h3>
      <p className="text-[12px] text-ink-mute">
        You can use a password instead of a one-time code to sign in. Must be at least 8 characters.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="text-[12px] font-medium text-ink">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-ink/15 bg-white px-3 py-2 text-[14px] text-ink outline-none transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2 focus:ring-gold/35"
            required
            minLength={8}
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-ink">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full border border-ink/15 bg-white px-3 py-2 text-[14px] text-ink outline-none transition-[box-shadow,border-color] focus:border-ink/25 focus:ring-2 focus:ring-gold/35"
            required
            minLength={8}
          />
        </label>
      </div>

      {error ? <p className="text-[12px] text-red-700">{error}</p> : null}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !canSubmit}
          className={cn(
            "rounded bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-[opacity,transform]",
            canSubmit && !pending ? "hover:-translate-y-px" : "cursor-not-allowed opacity-50"
          )}
        >
          {pending ? "Saving…" : "Save password"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setPassword("");
            setConfirm("");
            setError(null);
          }}
          disabled={pending}
          className="px-2 text-[13px] text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
