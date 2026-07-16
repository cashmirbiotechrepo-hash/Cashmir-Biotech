"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Brain,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
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

const CTA: Record<Step, string> = {
  courses: "Continue",
  details: "Continue",
  review: "Continue to payment"
};

export function CertificateDesk() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("courses");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSelectionDetails, setShowSelectionDetails] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const finalizedRef = useRef(false);

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
      hours: selectedCourses.reduce((s, c) => s + c.hours, 0),
      inclusive,
      ...split
    };
  }, [selectedCourses]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function goNext() {
    setError(null);
    if (step === "courses") {
      if (selected.length < 1) {
        setError("Select at least one course to continue.");
        return;
      }
      setStep("details");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === "details") {
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
      return;
    }
    void openPayment();
  }

  function goBack() {
    setError(null);
    if (step === "details") setStep("courses");
    if (step === "review") setStep("details");
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
    if (selected.length < 1 || !name.trim() || !email.trim()) {
      setError("Complete course selection and participant details first.");
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
        description: `Computational Biology · ${selected.length} course(s) · invoice ${formatInrFromCents(
          selected.length * 100_000
        )}`,
        order_id: checkout.razorpayOrderId,
        prefill: {
          name: name.trim(),
          email: email.trim(),
          contact: phone.trim() || undefined
        },
        theme: { color: "#0f3d32" },
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

  return (
    <div className="relative mx-auto min-h-screen max-w-3xl px-4 pb-36 pt-6 sm:px-6 sm:pt-8">
      {/* Brand mark */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[11px] font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          SK
        </div>
        <div>
          <p className="cert-title" style={{ fontSize: "0.9375rem" }}>
            {CERTIFICATE_ISSUER.shortName}
          </p>
          <p className="cert-caption">Continuing Education Cell · Shalimar</p>
        </div>
      </div>

      {/* Progress */}
      <nav aria-label="Enrolment progress" className="mb-8">
        <ol className="flex gap-2">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = s.id === step;
            return (
              <li key={s.id} className="flex flex-1">
                <button
                  type="button"
                  className="cert-step w-full"
                  data-active={active}
                  data-done={done}
                  disabled={i > stepIndex}
                  onClick={() => {
                    if (i < stepIndex) setStep(s.id);
                  }}
                >
                  <span className="cert-step-num">
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {step === "courses" ? (
        <div className="space-y-6">
          <header className="cert-surface-soft px-5 py-7 sm:px-7 sm:py-8">
            <p className="cert-overline" style={{ color: "var(--highlight)" }}>
              SKUAST-K Continuing Education
            </p>
            <h1 className="cert-display mt-3">
              Computational Biology
              <span className="mt-1 block font-normal text-[var(--text-secondary)]">Short Courses</span>
            </h1>
            <p className="cert-body mt-4 max-w-md">
              Certified modules from Shalimar Campus. One credit each · ₹1,000 incl. GST · start immediately.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Hours", value: `${TOTAL_HOURS}+` },
                { label: "Modules", value: "10" },
                { label: "Certificate", value: "Yes" },
                { label: "Starts", value: "Now" }
              ].map((stat) => (
                <div key={stat.label} className="rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 py-3">
                  <p className="cert-amount text-xl">{stat.value}</p>
                  <p className="cert-caption mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </header>

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="cert-h2">Choose courses</h2>
                <p className="cert-body mt-1">Tap a card to add it to your enrolment.</p>
              </div>
              <div className="flex gap-2">
                {[3, 7, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="cert-preset"
                    onClick={() => setSelected(CERTIFICATE_COURSES.slice(0, n).map((c) => c.id))}
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
        <div className="space-y-6">
          <div>
            <h2 className="cert-h2">Participant details</h2>
            <p className="cert-body mt-1">Used on your SKUAST-K tax invoice.</p>
          </div>

          <div className="cert-card p-5 sm:p-6">
            <Field icon={User} label="Full name" value={name} onChange={setName} autoComplete="name" placeholder="As on academic records" />
            <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="name@institution.edu" />
            <Field icon={Phone} label="Phone" value={phone} onChange={setPhone} autoComplete="tel" placeholder="+91 …" />
            <Field icon={Building2} label="Institution" value={institution} onChange={setInstitution} placeholder="College / lab / organisation" />
          </div>

          <SelectionSummary
            totals={totals}
            courses={selectedCourses}
            open={showSelectionDetails}
            onToggle={() => setShowSelectionDetails((v) => !v)}
          />
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-6">
          <div>
            <h2 className="cert-h2">Review & pay</h2>
            <p className="cert-body mt-1">Confirm details, then continue to secure payment.</p>
          </div>

          <div className="cert-card p-5 sm:p-6">
            <p className="cert-caption">Participant</p>
            <p className="cert-title mt-2">{name}</p>
            <p className="cert-body mt-1">{email}</p>
            {phone ? <p className="cert-body">{phone}</p> : null}
            {institution ? <p className="cert-body">{institution}</p> : null}
            <button type="button" className="cert-btn-text mt-3" onClick={() => setStep("details")}>
              Edit details
            </button>
          </div>

          <SelectionSummary
            totals={totals}
            courses={selectedCourses}
            open={showSelectionDetails}
            onToggle={() => setShowSelectionDetails((v) => !v)}
            emphasize
          />

          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: Lock, text: "Secure Razorpay checkout" },
              { icon: Award, text: "Official SKUAST-K tax invoice" },
              { icon: ShieldCheck, text: "Certificate-ready enrolment" },
              { icon: Clock, text: "Modules start immediately" }
            ].map((item) => (
              <li key={item.text} className="cert-trust">
                <item.icon className="h-4 w-4" strokeWidth={2} />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="cert-alert" role="alert">
          {error}
        </p>
      ) : null}

      {/* Sticky dock — same surface language as cards */}
      <div className="cert-dock">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <p className="cert-caption">
              {totals.count} course{totals.count === 1 ? "" : "s"} · {totals.credits} credit
              {totals.credits === 1 ? "" : "s"}
            </p>
            <p className="cert-amount text-2xl sm:text-[1.75rem]">{formatInrFromCents(totals.inclusive)}</p>
          </div>

          {step !== "courses" ? (
            <button type="button" className="cert-btn-ghost" onClick={goBack} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            className="cert-btn"
            onClick={goNext}
            disabled={submitting || (step === "courses" && totals.count < 1)}
          >
            {submitting ? "Opening…" : CTA[step]}
            {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
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
      <div className="cert-course relative overflow-hidden" data-selected={selected}>
        <button type="button" onClick={onToggle} className="flex w-full gap-4 p-4 text-left sm:p-5" aria-pressed={selected}>
          <span className="cert-course-icon shrink-0">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 pr-14">
            <span className="flex flex-wrap items-center gap-2">
              <span className="cert-badge">{course.difficulty}</span>
              <span className="cert-caption">
                {course.hours}h · 1 credit · {course.domain}
              </span>
            </span>
            <span className="cert-title mt-2 block">{course.title}</span>
            <span className="cert-body mt-1 block text-[0.875rem]">{course.blurb}</span>
            <span className="cert-caption mt-2 block">
              {course.instructor} · {course.department}
            </span>
          </span>
          <span className="absolute right-4 top-4 flex flex-col items-end gap-2">
            <span className="cert-check">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="cert-amount text-sm">{formatInrFromCents(course.feeInclusiveCents)}</span>
          </span>
        </button>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5 sm:px-5">
          <span className="cert-caption">{course.code}</span>
          <button type="button" className="cert-btn-text" onClick={onExpand}>
            {expanded ? "Hide outcomes" : "Learning outcomes"}
          </button>
        </div>
        {expanded ? (
          <ul className="space-y-2 border-t border-[var(--border)] bg-[var(--bg)] px-5 py-3">
            {course.outcomes.map((o) => (
              <li key={o} className="cert-body flex gap-2 text-[0.875rem]">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
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
  placeholder
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="cert-field">
      <span className="cert-field-label">{label}</span>
      <span className="cert-field-wrap">
        <Icon className="cert-field-icon" strokeWidth={2} />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="cert-input"
        />
      </span>
    </label>
  );
}

function SelectionSummary({
  totals,
  courses,
  open,
  onToggle,
  emphasize
}: {
  totals: { count: number; credits: number; hours: number; inclusive: number };
  courses: CertificateCourse[];
  open: boolean;
  onToggle: () => void;
  emphasize?: boolean;
}) {
  return (
    <div className="cert-card p-5 sm:p-6">
      <p className="cert-caption">Your selection</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className={`cert-amount ${emphasize ? "text-2xl" : "text-xl"}`}>{totals.count}</p>
          <p className="cert-caption mt-0.5">Courses</p>
        </div>
        <div>
          <p className={`cert-amount ${emphasize ? "text-2xl" : "text-xl"}`}>{totals.credits}</p>
          <p className="cert-caption mt-0.5">Credits</p>
        </div>
        <div>
          <p className={`cert-amount ${emphasize ? "text-2xl" : "text-xl"}`}>
            {formatInrFromCents(totals.inclusive)}
          </p>
          <p className="cert-caption mt-0.5">Total</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="mt-5 flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-left"
      >
        <span className="cert-title" style={{ fontSize: "0.875rem" }}>
          {totals.count} course{totals.count === 1 ? "" : "s"} selected
        </span>
        <span className="flex items-center gap-1 cert-caption" style={{ color: "var(--accent)" }}>
          {open ? "Hide" : "View details"}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open && courses.length > 0 ? (
        <ul className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
          {courses.map((c) => (
            <li key={c.id} className="flex justify-between gap-3 text-sm">
              <span className="text-[var(--text)]">{c.title}</span>
              <span className="cert-amount shrink-0 text-[var(--text-secondary)]">
                {formatInrFromCents(c.feeInclusiveCents)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="cert-caption mt-4">Fees inclusive of GST · {totals.hours} learning hours</p>
    </div>
  );
}
