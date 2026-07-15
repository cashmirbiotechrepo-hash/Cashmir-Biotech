"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CERTIFICATE_COURSES,
  CERTIFICATE_ISSUER,
  formatInrFromCents,
  splitInclusiveGst
} from "@/lib/certificate/courses";

type RazorpayInstance = { open: () => void };
type RazorpayCtor = new (options: object) => RazorpayInstance;

async function loadRazorpay(): Promise<RazorpayCtor | null> {
  if (typeof window === "undefined") return null;
  const existing = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return existing;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay ?? null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

type CheckoutResponse = {
  ok: boolean;
  error?: string;
  enrollmentId?: string;
  accessToken?: string;
  amountCents?: number;
  skipGateway?: boolean;
  keyId?: string;
  razorpayOrderId?: string | null;
  enrollmentNumber?: string;
  invoiceNumber?: string;
};

export function CertificateDesk() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCourses = useMemo(
    () => CERTIFICATE_COURSES.filter((c) => selected.includes(c.id)),
    [selected]
  );

  const totals = useMemo(() => {
    const inclusive = selectedCourses.reduce((s, c) => s + c.feeInclusiveCents, 0);
    const split = splitInclusiveGst(inclusive || 0);
    return {
      count: selectedCourses.length,
      credits: selectedCourses.length,
      inclusive,
      ...split
    };
  }, [selectedCourses]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectPreset(n: number) {
    setSelected(CERTIFICATE_COURSES.slice(0, n).map((c) => c.id));
  }

  async function finalize(payload: {
    enrollmentId: string;
    accessToken: string;
    gatewaySucceeded?: boolean;
    razorpayPaymentId?: string | null;
    razorpayOrderId?: string | null;
    razorpaySignature?: string | null;
  }) {
    const res = await fetch("/api/certificate/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      enrollmentId?: string;
      accessToken?: string;
    };
    if (!json.ok || !json.enrollmentId || !json.accessToken) {
      throw new Error(json.error || "Could not finalise enrolment.");
    }
    router.push(`/certificate/receipt?id=${json.enrollmentId}&t=${json.accessToken}`);
  }

  function onPay() {
    setError(null);
    if (selected.length < 1) {
      setError("Select at least one course.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required for the tax invoice.");
      return;
    }

    startTransition(async () => {
      try {
        const checkoutRes = await fetch("/api/certificate/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            studentName: name,
            studentEmail: email,
            studentPhone: phone,
            institution,
            courseIds: selected
          })
        });
        const checkout = (await checkoutRes.json()) as CheckoutResponse;
        if (!checkout.ok || !checkout.enrollmentId || !checkout.accessToken) {
          throw new Error(checkout.error || "Could not start enrolment.");
        }

        const base = {
          enrollmentId: checkout.enrollmentId,
          accessToken: checkout.accessToken
        };

        if (checkout.skipGateway || !checkout.razorpayOrderId || !checkout.keyId) {
          await finalize({ ...base, gatewaySucceeded: false });
          return;
        }

        const RazorpayCtor = await loadRazorpay();
        if (!RazorpayCtor) {
          // Gateway script failed — still complete successfully (page rule).
          await finalize({ ...base, gatewaySucceeded: false, razorpayOrderId: checkout.razorpayOrderId });
          return;
        }

        const rzp = new RazorpayCtor({
          key: checkout.keyId,
          amount: checkout.amountCents,
          currency: "INR",
          name: CERTIFICATE_ISSUER.shortName,
          description: `Computational Biology · ${selected.length} course(s)`,
          order_id: checkout.razorpayOrderId,
          prefill: { name, email, contact: phone || undefined },
          theme: { color: "#0c2b24" },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await finalize({
                ...base,
                gatewaySucceeded: true,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Payment recorded locally; contact programme desk.");
            }
          },
          modal: {
            ondismiss: async () => {
              // Page rule: dismiss / fail still issues paid invoice.
              try {
                await finalize({
                  ...base,
                  gatewaySucceeded: false,
                  razorpayOrderId: checkout.razorpayOrderId
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not issue receipt.");
              }
            }
          }
        });

        rzp.open();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 lg:px-10">
      <header className="mb-12 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--cert-sapphire)]">
          Unlisted programme desk · path /certificate
        </p>
        <h1 className="mt-4 text-4xl leading-[1.08] text-[var(--cert-pine)] sm:text-5xl">
          Computational Biology
          <span className="block text-[1.05em] text-[var(--cert-ink)]">Short Courses</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--cert-mute)]">
          Enrolment is issued under the Continuing Education Cell of{" "}
          <span className="font-medium text-[var(--cert-ink)]">{CERTIFICATE_ISSUER.shortName}</span>
          {" "}({CERTIFICATE_ISSUER.campus}). Each module carries{" "}
          <span className="font-medium text-[var(--cert-ink)]">1 academic credit</span> at{" "}
          <span className="font-medium text-[var(--cert-ink)]">₹1,000 inclusive of GST</span>.
          Compose any basket — three, seven, ten — then settle the fee and download your SKUAST-K tax invoice.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section aria-labelledby="courses-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="courses-heading" className="text-2xl text-[var(--cert-pine)]">
                Course ledger
              </h2>
              <p className="mt-1 text-sm text-[var(--cert-mute)]">Ten modules spanning computing and biology.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[3, 7, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => selectPreset(n)}
                  className="rounded-sm border border-[var(--cert-line)] bg-[var(--cert-card)] px-3 py-1.5 text-xs font-medium text-[var(--cert-pine)] transition hover:border-[var(--cert-foil)]"
                >
                  Select {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected([])}
                className="rounded-sm px-3 py-1.5 text-xs text-[var(--cert-mute)] underline-offset-2 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {CERTIFICATE_COURSES.map((course, index) => {
              const on = selected.includes(course.id);
              return (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => toggle(course.id)}
                    aria-pressed={on}
                    className={`group flex w-full gap-4 rounded-sm border px-4 py-4 text-left transition sm:px-5 ${
                      on
                        ? "border-[var(--cert-pine)] bg-[var(--cert-card)] shadow-[0_0_0_1px_var(--cert-pine)]"
                        : "border-[var(--cert-line)] bg-[var(--cert-card)]/70 hover:border-[var(--cert-pine)]/35"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border text-[10px] ${
                        on
                          ? "border-[var(--cert-pine)] bg-[var(--cert-pine)] text-[var(--cert-paper)]"
                          : "border-[var(--cert-line)] text-transparent"
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cert-sapphire)]">
                          {String(index + 1).padStart(2, "0")} · {course.code}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cert-mute)]">
                          {course.domain} · {course.hours}h · 1 credit
                        </span>
                      </span>
                      <span className="mt-1 block text-lg leading-snug text-[var(--cert-ink)] cert-display">
                        {course.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-[var(--cert-mute)]">
                        {course.subtitle}
                      </span>
                    </span>
                    <span className="shrink-0 self-center font-mono text-sm text-[var(--cert-pine)]">
                      {formatInrFromCents(course.feeInclusiveCents)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="lg:sticky lg:top-8">
          <div className="rounded-sm border border-[var(--cert-line)] bg-[var(--cert-card)] p-5 shadow-[0_24px_60px_-40px_rgba(7,26,22,0.55)] sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--cert-foil)]">
              Enrolment & tax invoice
            </p>
            <h2 className="mt-2 text-xl text-[var(--cert-pine)]">Participant details</h2>

            <div className="mt-5 space-y-3">
              <label className="block text-xs font-medium text-[var(--cert-mute)]">
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-sm border border-[var(--cert-line)] bg-white/80 px-3 py-2.5 text-sm text-[var(--cert-ink)] outline-none ring-[var(--cert-foil)] focus:ring-1"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--cert-mute)]">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-sm border border-[var(--cert-line)] bg-white/80 px-3 py-2.5 text-sm text-[var(--cert-ink)] outline-none ring-[var(--cert-foil)] focus:ring-1"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--cert-mute)]">
                Phone
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  className="mt-1.5 w-full rounded-sm border border-[var(--cert-line)] bg-white/80 px-3 py-2.5 text-sm text-[var(--cert-ink)] outline-none ring-[var(--cert-foil)] focus:ring-1"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--cert-mute)]">
                Institution / affiliation
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="mt-1.5 w-full rounded-sm border border-[var(--cert-line)] bg-white/80 px-3 py-2.5 text-sm text-[var(--cert-ink)] outline-none ring-[var(--cert-foil)] focus:ring-1"
                />
              </label>
            </div>

            <div className="mt-6 border-t border-[var(--cert-line)] pt-5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--cert-mute)]">Courses selected</span>
                <span className="font-medium">{totals.count}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[var(--cert-mute)]">Credits</span>
                <span className="font-medium">{totals.credits}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[var(--cert-mute)]">Taxable</span>
                <span>{formatInrFromCents(totals.taxableCents)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[var(--cert-mute)]">GST (18% incl.)</span>
                <span>{formatInrFromCents(totals.taxCents)}</span>
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-[var(--cert-line)] pt-4">
                <span className="text-sm font-medium text-[var(--cert-pine)]">Payable</span>
                <span className="cert-display text-3xl text-[var(--cert-pine)]">
                  {formatInrFromCents(totals.inclusive)}
                </span>
              </div>
              {selectedCourses.length > 0 ? (
                <ul className="mt-4 max-h-36 space-y-1.5 overflow-y-auto text-xs text-[var(--cert-mute)]">
                  {selectedCourses.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="truncate">{c.code}</span>
                      <span className="shrink-0 font-mono">{formatInrFromCents(c.feeInclusiveCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={onPay}
              disabled={pending}
              className="mt-6 w-full rounded-sm bg-[var(--cert-pine)] px-4 py-3.5 text-sm font-semibold tracking-wide text-[var(--cert-paper)] transition hover:bg-[var(--cert-pine-deep)] disabled:opacity-60"
            >
              {pending ? "Preparing payment…" : "Proceed to payment"}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--cert-mute)]">
              Payment is processed through Razorpay. On this desk, enrolment and the SKUAST-K tax invoice are
              completed even if the gateway is dismissed or declines — you will still receive a paid receipt.
            </p>
          </div>

          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--cert-mute)]">
            {CERTIFICATE_ISSUER.programmeCode}
          </p>
        </aside>
      </div>
    </div>
  );
}
