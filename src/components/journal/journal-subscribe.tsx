"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Compact journal subscribe — same API as homepage, quieter chrome. */
export function JournalSubscribe() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setStatus("ok");
        setMsg("You're on the laboratory log.");
        setEmail("");
      } else {
        setStatus("err");
        setMsg(res.status === 422 ? "Enter a valid email." : "Try again shortly.");
      }
    } catch {
      setStatus("err");
      setMsg("Network error.");
    }
  }

  return (
    <div className="mt-5 max-w-md">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="lab@your-institution.edu"
          className="flex-1 border-0 border-b border-ink/15 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={cn(
            "shrink-0 bg-ink px-5 py-2.5 text-[12px] font-medium tracking-wide text-paper transition-opacity",
            status === "loading" && "opacity-50"
          )}
        >
          {status === "loading" ? "…" : "Subscribe"}
        </button>
      </form>
      {msg ? (
        <p className={cn("mt-2 text-[12px]", status === "ok" ? "text-gold" : "text-ink-mute")}>{msg}</p>
      ) : null}
    </div>
  );
}
