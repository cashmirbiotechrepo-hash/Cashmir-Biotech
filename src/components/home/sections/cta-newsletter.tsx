"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal, RevealText } from "@/components/ui/reveal";
import { LuxeButton } from "@/components/ui/luxe-button";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";

type Status = "idle" | "loading" | "success" | "error";

export function CtaNewsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setStatus("success");
        setMessage("You're on the list. We'll be in touch.");
        setEmail("");
      } else if (res.status === 422) {
        setStatus("error");
        setMessage("Please enter a valid email address.");
      } else if (res.status === 429) {
        setStatus("error");
        setMessage("Too many attempts — try again shortly.");
      } else {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <section id="access" className="relative px-4 pb-24 md:px-8">
      <div className="relative mx-auto max-w-frame overflow-hidden rounded-[2rem] bg-ink px-6 py-24 text-paper md:rounded-[2.5rem] md:px-16 md:py-32">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute left-1/2 top-1/2 h-[70vw] w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-full [background:radial-gradient(circle,rgba(184,148,88,0.22),transparent_60%)]" />
          <div className="absolute -right-20 top-10 h-72 w-72 rounded-full [background:radial-gradient(circle,rgba(111,168,206,0.24),transparent_65%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <p className="technical mb-6 !text-gold-soft">Institutional Access</p>
          <h2 className="text-[clamp(2rem,4.5vw,3.75rem)] font-light leading-[1.06] tracking-tightest">
            <RevealText
              text="Partner in the next era of precision nutrition."
              accentWords={[4]}
            />
          </h2>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-md leading-relaxed text-paper/60">
              Research collaborations and formulation enquiries open each quarter. Join the
              list for the next release from the registry.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <form onSubmit={submit} className="mx-auto mt-11 max-w-md">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <div className="flex flex-col gap-2 rounded-3xl border border-paper/15 bg-paper/[0.05] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-colors duration-300 focus-within:border-gold/60 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:pl-6">
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@institution.org"
                  className="h-11 w-full flex-1 rounded-full bg-transparent px-5 text-center text-sm text-paper placeholder:text-paper/40 focus:outline-none sm:px-0 sm:text-left"
                />
                <LuxeButton
                  type="submit"
                  variant="light"
                  magnetic={false}
                  className="h-11 w-full justify-center sm:w-auto"
                >
                  {status === "loading" ? "Sending…" : "Request Access"}
                </LuxeButton>
              </div>
            </form>
          </Reveal>

          <AnimatePresence mode="wait">
            {message ? (
              <motion.div
                key={message}
                role="status"
                initial={{ opacity: 0, y: 8 }}
                animate={
                  status === "error"
                    ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }
                    : { opacity: 1, y: 0 }
                }
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                className={`mt-5 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] ${
                  status === "success" ? "text-gold-soft" : "text-paper/70"
                }`}
              >
                {status === "success" ? (
                  <motion.svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="text-gold-soft"
                  >
                    <motion.path
                      d="M4 12.5l5 5L20 6"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.1 }}
                    />
                  </motion.svg>
                ) : null}
                {message}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
