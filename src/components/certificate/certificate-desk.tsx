"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Brain,
  Building2,
  Check,
  Clock,
  Code2,
  Database,
  Dna,
  Hexagon,
  Lock,
  Mail,
  Microscope,
  Network,
  Phone,
  Scan,
  ShieldCheck,
  User,
  Workflow
} from "lucide-react";
import {
  CERTIFICATE_COURSES,
  CERTIFICATE_ISSUER,
  formatInrExact,
  formatInrFromCents,
  splitInclusiveGst,
  type CertificateCourse,
  type CourseIconKey
} from "@/lib/certificate/courses";

type Step = "courses" | "details" | "review";

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (response: { error?: { description?: string } }) => void) => void;
};

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    const w = window as Window & { Razorpay?: new (o: RazorpayOptions) => RazorpayInstance };
    if (w.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${RZP_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = RZP_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const ICONS: Record<CourseIconKey, typeof Dna> = {
  genomics: Dna,
  python: Code2,
  pipeline: Workflow,
  ml: Brain,
  blast: Database,
  protein: Hexagon,
  network: Network,
  microbiome: Microscope,
  pathology: Scan,
  ethics: ShieldCheck
};

const STEPS: { id: Step; label: string }[] = [
  { id: "courses", label: "Courses" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" }
];

const TOTAL_HOURS = CERTIFICATE_COURSES.reduce((s, c) => s + c.hours, 0);

export function CertificateDesk() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("courses");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [totalPulse, setTotalPulse] = useState(0);
  const finalizedRef = useRef(false);

  const selectedCourses = useMemo(
    () => CERTIFICATE_COURSES.filter((c) => selected.includes(c.id)),
    [selected]
  );

  const totals = useMemo(() => {
    const inclusive = selectedCourses.reduce((s, c) => s + c.feeInclusiveCents, 0);
    const split = splitInclusiveGst(inclusive || 0);
    const hours = selectedCourses.reduce((s, c) => s + c.hours, 0);
    return {
      count: selectedCourses.length,
      credits: selectedCourses.length,
      hours,
      inclusive,
      ...split
    };
  }, [selectedCourses]);

  useEffect(() => {
    if (totals.count > 0) setTotalPulse((n) => n + 1);
  }, [totals.inclusive, totals.count]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function goDetails() {
    setError(null);
    if (selected.length < 1) {
      setError("Select at least one course to continue.");
      return;
    }
    setStep("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goReview() {
    setError(null);
    if (!name.trim() || name.trim().length < 2) {
      setError("Enter the participant’s full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email for the invoice.");
      return;
    }
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finalize(payload: {
    enrollmentId: string;
    accessToken: string;
    gatewaySucceeded?: boolean;
    razorpayPaymentId?: string | null;
    razorpayOrderId?: string | null;
    razorpaySignature?: string | null;
  }) {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
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
      finalizedRef.current = false;
      throw new Error(json.error || "Could not finalise enrolment.");
    }
    router.push(`/certificate/receipt?id=${json.enrollmentId}&t=${json.accessToken}`);
  }

  async function openPayment() {
    setError(null);
    if (selected.length < 1) {
      setError("Select at least one course.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setSubmitting(true);
    finalizedRef.current = false;

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
      const checkout = (await checkoutRes.json()) as {
        ok: boolean;
        error?: string;
        enrollmentId?: string;
        accessToken?: string;
        amountCents?: number;
        currency?: string;
        keyId?: string;
        razorpayOrderId?: string;
      };

      if (!checkout.ok || !checkout.enrollmentId || !checkout.accessToken) {
        throw new Error(checkout.error || "Could not start enrolment.");
      }
      if (!checkout.razorpayOrderId || !checkout.keyId || !checkout.amountCents) {
        throw new Error("Payment gateway could not be prepared. Please try again.");
      }

      const base = {
        enrollmentId: checkout.enrollmentId,
        accessToken: checkout.accessToken
      };

      const loaded = await loadRazorpay();
      const RazorpayCtor = (window as Window & { Razorpay?: new (o: RazorpayOptions) => RazorpayInstance })
        .Razorpay;
      if (!loaded || !RazorpayCtor) {
        throw new Error("Could not load Razorpay. Check your connection and try again.");
      }

      const rzp = new RazorpayCtor({
        key: checkout.keyId,
        amount: checkout.amountCents,
        currency: checkout.currency || "INR",
        name: CERTIFICATE_ISSUER.shortName,
        description: `Computational Biology · ${selected.length} course(s)`,
        order_id: checkout.razorpayOrderId,
        prefill: {
          name: name.trim(),
          email: email.trim(),
          contact: phone.trim() || undefined
        },
        theme: { color: "#0a2922" },
        handler: async (response) => {
          try {
            await finalize({
              ...base,
              gatewaySucceeded: true,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature
            });
          } catch (e) {
            setSubmitting(false);
            setError(e instanceof Error ? e.message : "Could not confirm payment.");
          }
        },
        modal: {
          ondismiss: async () => {
            // After gateway interaction: dismiss still completes enrolment (programme rule).
            try {
              await finalize({
                ...base,
                gatewaySucceeded: false,
                razorpayOrderId: checkout.razorpayOrderId
              });
            } catch (e) {
              setSubmitting(false);
              setError(e instanceof Error ? e.message : "Could not issue receipt.");
            }
          }
        }
      }) as RazorpayInstance;

      if (typeof rzp.on === "function") {
        rzp.on("payment.failed", async () => {
          try {
            await finalize({
              ...base,
              gatewaySucceeded: false,
              razorpayOrderId: checkout.razorpayOrderId
            });
          } catch (e) {
            setSubmitting(false);
            setError(e instanceof Error ? e.message : "Could not issue receipt.");
          }
        });
      }

      rzp.open();
      setSubmitting(false);
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="relative mx-auto min-h-screen max-w-3xl px-4 pb-36 pt-6 sm:px-6 sm:pt-10">
      {/* University mark */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cert-pine)] text-[10px] font-bold tracking-wide text-[var(--cert-paper)]">
          SK
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--cert-pine)]">{CERTIFICATE_ISSUER.shortName}</p>
          <p className="text-xs text-[var(--cert-mute)]">Continuing Education Cell · Shalimar</p>
        </div>
      </div>

      {/* Progress */}
      <nav aria-label="Enrolment progress" className="mb-8">
        <ol className="flex items-center gap-1 sm:gap-2">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = s.id === step;
            return (
              <li key={s.id} className="flex flex-1 items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  disabled={i > stepIndex}
                  onClick={() => {
                    if (i < stepIndex) setStep(s.id);
                  }}
                  className={`flex w-full items-center gap-2 rounded-full px-2.5 py-2 text-left sm:px-3 ${
                    active
                      ? "bg-[var(--cert-pine)] text-[var(--cert-paper)]"
                      : done
                        ? "bg-[var(--cert-sage)] text-[var(--cert-pine)]"
                        : "bg-white/60 text-[var(--cert-mute)]"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      active
                        ? "bg-[var(--cert-foil)] text-[var(--cert-pine)]"
                        : done
                          ? "bg-[var(--cert-pine)] text-white"
                          : "bg-white text-[var(--cert-mute)]"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="hidden text-xs font-medium sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 ? (
                  <span className="hidden h-px w-3 shrink-0 bg-[var(--cert-line)] sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === "courses" ? (
        <div key="courses" className="cert-step-enter space-y-8">
          <header className="cert-hero-mesh cert-dna overflow-hidden rounded-2xl px-5 py-8 text-[var(--cert-paper)] sm:px-8 sm:py-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--cert-foil)]">
              SKUAST-K Continuing Education
            </p>
            <h1 className="mt-3 max-w-lg text-3xl leading-[1.1] sm:text-4xl md:text-[2.75rem]">
              Computational Biology
              <span className="mt-1 block font-normal text-white/85">Short Courses</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              Certified modules from Shalimar Campus. One credit each · ₹1,000 incl. GST · start immediately.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Hours", value: `${TOTAL_HOURS}+` },
                { label: "Modules", value: "10" },
                { label: "Certificate", value: "SKUAST-K" },
                { label: "Starts", value: "Now" }
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/10 px-3 py-3 backdrop-blur-sm">
                  <p className="cert-display text-xl text-white sm:text-2xl">{stat.value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/55">{stat.label}</p>
                </div>
              ))}
            </div>
          </header>

          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl text-[var(--cert-pine)]">Choose courses</h2>
                <p className="mt-1 text-sm text-[var(--cert-mute)]">Tap a card to add it to your enrolment.</p>
              </div>
              <div className="flex gap-2">
                {[3, 7, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelected(CERTIFICATE_COURSES.slice(0, n).map((c) => c.id))}
                    className="rounded-full border border-[var(--cert-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--cert-pine)]"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <ul className="space-y-4">
              {CERTIFICATE_COURSES.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  selected={selected.includes(course.id)}
                  expanded={expanded === course.id}
                  onToggle={() => toggle(course.id)}
                  onExpand={() => setExpanded((e) => (e === course.id ? null : course.id))}
                />
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {step === "details" ? (
        <div key="details" className="cert-step-enter space-y-6">
          <div>
            <h2 className="text-2xl text-[var(--cert-pine)]">Participant details</h2>
            <p className="mt-1 text-sm text-[var(--cert-mute)]">Used on your SKUAST-K tax invoice.</p>
          </div>

          <div className="rounded-2xl border border-[var(--cert-line)] bg-[var(--cert-card)] p-5 shadow-[0_20px_50px_-36px_rgba(10,41,34,0.45)] sm:p-7">
            <Field
              icon={User}
              label="Full name"
              value={name}
              onChange={setName}
              autoComplete="name"
              placeholder="As on academic records"
            />
            <Field
              icon={Mail}
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="name@institution.edu"
            />
            <Field
              icon={Phone}
              label="Phone"
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
              placeholder="+91 …"
            />
            <Field
              icon={Building2}
              label="Institution"
              value={institution}
              onChange={setInstitution}
              placeholder="College / lab / organisation"
              last
            />
          </div>

          <SelectionSummary totals={totals} courses={selectedCourses} pulseKey={totalPulse} />
        </div>
      ) : null}

      {step === "review" ? (
        <div key="review" className="cert-step-enter space-y-6">
          <div>
            <h2 className="text-2xl text-[var(--cert-pine)]">Review & pay</h2>
            <p className="mt-1 text-sm text-[var(--cert-mute)]">Confirm details, then open secure payment.</p>
          </div>

          <div className="rounded-2xl border border-[var(--cert-line)] bg-[var(--cert-card)] p-5 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cert-foil)]">
              Participant
            </p>
            <p className="mt-2 text-lg font-medium text-[var(--cert-ink)]">{name}</p>
            <p className="text-sm text-[var(--cert-mute)]">{email}</p>
            {phone ? <p className="text-sm text-[var(--cert-mute)]">{phone}</p> : null}
            {institution ? <p className="text-sm text-[var(--cert-mute)]">{institution}</p> : null}
            <button
              type="button"
              onClick={() => setStep("details")}
              className="mt-3 text-xs font-medium text-[var(--cert-sapphire)] underline-offset-2 hover:underline"
            >
              Edit details
            </button>
          </div>

          <SelectionSummary totals={totals} courses={selectedCourses} pulseKey={totalPulse} large />

          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: Lock, text: "Secure Razorpay checkout" },
              { icon: Award, text: "Official SKUAST-K tax invoice" },
              { icon: ShieldCheck, text: "Certificate-ready enrolment" },
              { icon: Clock, text: "Modules start immediately" }
            ].map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-2.5 rounded-xl bg-[var(--cert-sage)]/50 px-3.5 py-3 text-sm text-[var(--cert-pine)]"
              >
                <item.icon className="h-4 w-4 shrink-0 text-[var(--cert-foil)]" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      {/* Sticky conversion bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--cert-line)] bg-[var(--cert-card)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cert-mute)]">
              {totals.count} course{totals.count === 1 ? "" : "s"} · {totals.credits} credit
              {totals.credits === 1 ? "" : "s"}
            </p>
            <p
              key={totalPulse}
              className={`cert-display text-2xl text-[var(--cert-pine)] sm:text-3xl ${
                totalPulse ? "cert-total-pulse" : ""
              }`}
            >
              {formatInrFromCents(totals.inclusive)}
            </p>
          </div>

          {step === "courses" ? (
            <button
              type="button"
              onClick={goDetails}
              disabled={selected.length < 1}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--cert-pine)] px-5 py-3.5 text-sm font-semibold text-[var(--cert-paper)] disabled:opacity-40"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}

          {step === "details" ? (
            <>
              <button
                type="button"
                onClick={() => setStep("courses")}
                className="rounded-full border border-[var(--cert-line)] px-3 py-3.5 text-[var(--cert-mute)]"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goReview}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--cert-pine)] px-5 py-3.5 text-sm font-semibold text-[var(--cert-paper)]"
              >
                Review
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : null}

          {step === "review" ? (
            <>
              <button
                type="button"
                onClick={() => setStep("details")}
                className="rounded-full border border-[var(--cert-line)] px-3 py-3.5 text-[var(--cert-mute)]"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void openPayment()}
                disabled={submitting || totals.count < 1}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--cert-pine)] px-5 py-3.5 text-sm font-semibold text-[var(--cert-paper)] disabled:opacity-50"
              >
                {submitting ? "Opening…" : "Secure payment"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CourseCard({
  course,
  selected,
  expanded,
  onToggle,
  onExpand
}: {
  course: CertificateCourse;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const Icon = ICONS[course.icon];
  return (
    <li>
      <div
        data-selected={selected}
        className={`cert-card-lift relative overflow-hidden rounded-2xl border bg-[var(--cert-card)] ${
          selected ? "border-[var(--cert-pine)]" : "border-[var(--cert-line)]"
        }`}
      >
        <button type="button" onClick={onToggle} className="flex w-full gap-4 p-4 text-left sm:p-5" aria-pressed={selected}>
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              selected ? "bg-[var(--cert-pine)] text-[var(--cert-foil)]" : "bg-[var(--cert-mist)] text-[var(--cert-pine)]"
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 pr-8">
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--cert-sage)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cert-pine)]">
                {course.difficulty}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--cert-mute)]">
                {course.hours}h · 1 credit · {course.domain}
              </span>
            </span>
            <span className="mt-1.5 block text-lg leading-snug text-[var(--cert-ink)] cert-display sm:text-xl">
              {course.title}
            </span>
            <span className="mt-1 block text-sm leading-snug text-[var(--cert-mute)]">{course.blurb}</span>
            <span className="mt-2 block text-xs text-[var(--cert-mute)]">
              {course.instructor} · {course.department}
            </span>
          </span>
          <span className="absolute right-4 top-4 flex flex-col items-end gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                selected
                  ? "border-[var(--cert-pine)] bg-[var(--cert-pine)] text-white"
                  : "border-[var(--cert-line)] bg-white text-transparent"
              }`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="font-mono text-sm font-semibold text-[var(--cert-pine)]">
              {formatInrFromCents(course.feeInclusiveCents)}
            </span>
          </span>
        </button>
        <div className="flex items-center justify-between border-t border-[var(--cert-line)] px-4 py-2.5 sm:px-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cert-sapphire)]">
            {course.code} · Certificate
          </span>
          <button
            type="button"
            onClick={onExpand}
            className="text-xs font-medium text-[var(--cert-sapphire)] underline-offset-2 hover:underline"
          >
            {expanded ? "Hide outcomes" : "Learning outcomes"}
          </button>
        </div>
        {expanded ? (
          <ul className="space-y-1.5 border-t border-[var(--cert-line)] bg-[var(--cert-mist)]/60 px-5 py-3 text-sm text-[var(--cert-mute)]">
            {course.outcomes.map((o) => (
              <li key={o} className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cert-success)]" />
                {o}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  last
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  last?: boolean;
}) {
  return (
    <label className={`block ${last ? "" : "mb-4"}`}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--cert-mute)]">{label}</span>
      <span className="relative flex items-center">
        <Icon className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--cert-foil)]" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--cert-line)] bg-[var(--cert-mist)]/40 py-3.5 pl-11 pr-3.5 text-sm text-[var(--cert-ink)] outline-none transition placeholder:text-[var(--cert-mute)]/60 focus:border-[var(--cert-pine)] focus:bg-white focus:ring-2 focus:ring-[var(--cert-sage)]"
        />
      </span>
    </label>
  );
}

function SelectionSummary({
  totals,
  courses,
  pulseKey,
  large
}: {
  totals: {
    count: number;
    credits: number;
    hours: number;
    inclusive: number;
    taxableCents: number;
    taxCents: number;
  };
  courses: CertificateCourse[];
  pulseKey: number;
  large?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--cert-pine)]/15 bg-[var(--cert-pine)] px-5 py-6 text-[var(--cert-paper)] sm:px-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--cert-foil)]">Your selection</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className={`cert-display ${large ? "text-3xl" : "text-2xl"}`}>{totals.count}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">Courses</p>
        </div>
        <div>
          <p className={`cert-display ${large ? "text-3xl" : "text-2xl"}`}>{totals.credits}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">Credits</p>
        </div>
        <div>
          <p
            key={pulseKey}
            className={`cert-display ${large ? "text-3xl" : "text-2xl"} ${pulseKey ? "cert-total-pulse" : ""}`}
          >
            {formatInrFromCents(totals.inclusive)}
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">Total</p>
        </div>
      </div>
      {courses.length > 0 ? (
        <ul className="mt-5 max-h-40 space-y-2 overflow-y-auto border-t border-white/10 pt-4 text-sm text-white/80">
          {courses.map((c) => (
            <li key={c.id} className="flex justify-between gap-3">
              <span className="truncate">{c.title}</span>
              <span className="shrink-0 font-mono text-white/60">{formatInrExact(c.feeInclusiveCents)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-white/50">Fees inclusive of GST · {totals.hours} learning hours</p>
    </div>
  );
}
