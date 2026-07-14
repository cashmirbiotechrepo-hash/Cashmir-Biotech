"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Circle,
  CreditCard,
  Lock,
  Smartphone,
  Wallet
} from "lucide-react";
import { useCart } from "@/components/shop/cart-context";
import { EASE_OUT_EXPO } from "@/lib/motion/ease";
import { cn } from "@/lib/utils";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
const FREE_SHIPPING_THRESHOLD = 999;
const FLAT_SHIPPING = 60;

const TRUST_LINES = [
  "Patent-backed formulation",
  "Developed with SKUAST-K researchers",
  "GMP manufacturing standards",
  "Secure Razorpay payment",
  "GST invoice included",
  "Batch verified before dispatch"
] as const;

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
] as const;

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

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = RZP_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;

const EMPTY: FormState = {
  fullName: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India"
};

function validateField(key: FieldKey, form: FormState): string | undefined {
  const v = form[key].trim();
  switch (key) {
    case "fullName":
      return v.length < 2 ? "Enter your full name" : undefined;
    case "email":
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Enter a valid email" : undefined;
    case "phone": {
      const digits = v.replace(/\D/g, "");
      if (digits.length < 10) return "Enter a 10-digit mobile number";
      return undefined;
    }
    case "line1":
      return v.length < 3 ? "Enter your street address" : undefined;
    case "line2":
      return undefined;
    case "city":
      return v.length < 2 ? "Enter city" : undefined;
    case "state":
      return v.length < 2 ? "Select state" : undefined;
    case "postalCode":
      return !/^\d{6}$/.test(v) ? "Enter a 6-digit PIN" : undefined;
    case "country":
      return v.length < 2 ? "Select country" : undefined;
    default:
      return undefined;
  }
}

function validateKeys(form: FormState, keys: FieldKey[]): boolean {
  return keys.every((k) => !validateField(k, form));
}

function validateAll(form: FormState): Errors {
  const keys: FieldKey[] = [
    "fullName",
    "email",
    "phone",
    "line1",
    "city",
    "state",
    "postalCode",
    "country"
  ];
  const next: Errors = {};
  for (const k of keys) {
    const err = validateField(k, form);
    if (err) next[k] = err;
  }
  return next;
}

export type SavedCheckoutAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export function CheckoutView({
  savedAddresses = [],
  prefillEmail = ""
}: {
  savedAddresses?: SavedCheckoutAddress[];
  prefillEmail?: string;
}) {
  const { items, ready, subtotalInr, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    email: prefillEmail
  }));
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinStatus, setPinStatus] = useState<"idle" | "loading" | "ok" | "miss">("idle");
  const [shippingMethod, setShippingMethod] = useState<"standard">("standard");

  useEffect(() => {
    if (ready && items.length === 0 && !submitting) {
      router.replace("/cart");
    }
  }, [ready, items.length, submitting, router]);

  const shipping = subtotalInr >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const total = subtotalInr + shipping;

  const contactDone = validateKeys(form, ["email", "phone"]);
  const addressDone = validateKeys(form, [
    "fullName",
    "line1",
    "city",
    "state",
    "postalCode",
    "country"
  ]);

  const errors = useMemo(() => {
    if (!attempted && Object.keys(touched).length === 0) return {} as Errors;
    const all = validateAll(form);
    if (attempted) return all;
    const partial: Errors = {};
    for (const k of Object.keys(touched) as FieldKey[]) {
      if (touched[k] && all[k]) partial[k] = all[k];
    }
    return partial;
  }, [form, touched, attempted]);

  const isValid = useMemo(() => Object.keys(validateAll(form)).length === 0, [form]);

  const set =
    (key: FieldKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [key]: value }));
      if (key === "postalCode") setPinStatus("idle");
    };

  const blur = (key: FieldKey) => () => setTouched((t) => ({ ...t, [key]: true }));

  useEffect(() => {
    const pin = form.postalCode.trim();
    if (!/^\d{6}$/.test(pin)) return;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      setPinStatus("loading");
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = (await res.json()) as Array<{
          Status?: string;
          PostOffice?: Array<{ District?: string; State?: string; Name?: string }>;
        }>;
        if (cancelled) return;
        const office = data?.[0]?.PostOffice?.[0];
        if (data?.[0]?.Status === "Success" && office) {
          setForm((f) => ({
            ...f,
            city: office.District || office.Name || f.city,
            state: office.State || f.state
          }));
          setPinStatus("ok");
        } else {
          setPinStatus("miss");
        }
      } catch {
        if (!cancelled) setPinStatus("miss");
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [form.postalCode]);

  const focusFirstError = useCallback((errs: Errors) => {
    const order: FieldKey[] = [
      "email",
      "phone",
      "fullName",
      "line1",
      "city",
      "state",
      "postalCode",
      "country"
    ];
    const first = order.find((k) => errs[k]);
    if (!first) return;
    const el = document.getElementById(`field-${first}`);
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    const errs = validateAll(form);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          address: form
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Checkout failed. Please try again.");
        setSubmitting(false);
        return;
      }

      // Test mode: server completed the order without Razorpay.
      if (data.skipPayment && data.orderNumber) {
        clear();
        const t = data.confirmationToken ? `?t=${encodeURIComponent(data.confirmationToken)}` : "";
        router.push(`/order/${data.orderNumber}${t}`);
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) {
        setError("Could not load the payment gateway. Check your connection and retry.");
        setSubmitting(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amountCents,
        currency: data.currency,
        name: "Cashmir Biotech",
        description: `Order ${data.orderNumber}`,
        order_id: data.razorpayOrderId,
        prefill: { name: data.customer?.name, email: data.customer?.email, contact: data.customer?.phone },
        theme: { color: "#111111" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.ok) {
              clear();
              const t = verifyData.confirmationToken
                ? `?t=${encodeURIComponent(verifyData.confirmationToken)}`
                : "";
              router.push(`/order/${verifyData.orderNumber}${t}`);
            } else {
              setError(
                "Payment could not be verified. If money was deducted, contact us with your order number."
              );
              setSubmitting(false);
            }
          } catch {
            setError("Something went wrong verifying your payment. Please contact us.");
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setError("Payment was cancelled. Your formula is saved — you can try again.");
          }
        }
      });
      rzp.open();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="frame pt-5">
        <div className="h-40 animate-pulse bg-pearl/80" />
      </div>
    );
  }

  return (
    <div className="frame pt-4 md:pt-5">
      <div className="flex flex-col gap-3 border-b border-ink/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] text-ink-mute">Cashmir Biotech · Research purchase</p>
          <h1 className="mt-0.5 text-[1.35rem] font-light tracking-tight text-ink md:text-[1.5rem]">
            Complete your order
          </h1>
        </div>
        <CheckoutProgress contactDone={contactDone} addressDone={addressDone} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:mt-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:gap-14">
        <form id="checkout-form" onSubmit={handleSubmit} noValidate>
          <Section title="Contact" index="01" complete={contactDone}>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
              <Field
                id="field-email"
                label="Email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                onBlur={blur("email")}
                error={errors.email}
                className="sm:col-span-2"
                required
              />
              <Field
                id="field-phone"
                label="Mobile"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={set("phone")}
                onBlur={blur("phone")}
                error={errors.phone}
                hint="For OTP and courier updates"
                required
              />
            </div>
          </Section>

          <Section title="Ship to" index="02" complete={addressDone}>
            {savedAddresses.length > 0 ? (
              <div className="mb-4 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  Saved portal addresses
                </p>
                <div className="flex flex-wrap gap-2">
                  {savedAddresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          fullName: a.fullName || f.fullName,
                          phone: a.phone || f.phone,
                          line1: a.line1,
                          line2: a.line2,
                          city: a.city,
                          state: a.state,
                          postalCode: a.postalCode,
                          country: a.country || "India"
                        }));
                        setTouched((t) => ({
                          ...t,
                          fullName: true,
                          phone: true,
                          line1: true,
                          city: true,
                          state: true,
                          postalCode: true,
                          country: true
                        }));
                      }}
                      className="rounded-full border border-ink/15 px-3 py-1.5 text-left text-[12px] text-ink transition-colors hover:border-gold/50 hover:bg-pearl/60"
                    >
                      <span className="font-medium">{a.label}</span>
                      {a.isDefault ? <span className="ml-1 text-gold">· default</span> : null}
                      <span className="mt-0.5 block text-[11px] text-ink-mute">
                        {a.city}, {a.state}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
              <Field
                id="field-fullName"
                label="Full name"
                autoComplete="name"
                value={form.fullName}
                onChange={set("fullName")}
                onBlur={blur("fullName")}
                error={errors.fullName}
                className="sm:col-span-2"
                required
              />
              <Field
                id="field-line1"
                label="Address"
                autoComplete="address-line1"
                value={form.line1}
                onChange={set("line1")}
                onBlur={blur("line1")}
                error={errors.line1}
                className="sm:col-span-2"
                required
              />
              <Field
                id="field-line2"
                label="Apartment, suite (optional)"
                autoComplete="address-line2"
                value={form.line2}
                onChange={set("line2")}
                onBlur={blur("line2")}
                className="sm:col-span-2"
              />
              <Field
                id="field-postalCode"
                label="PIN code"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={6}
                value={form.postalCode}
                onChange={set("postalCode")}
                onBlur={blur("postalCode")}
                error={errors.postalCode}
                hint={
                  pinStatus === "loading"
                    ? "Looking up locality…"
                    : pinStatus === "ok"
                      ? "City & state filled from PIN"
                      : pinStatus === "miss"
                        ? "PIN not found — enter city manually"
                        : "Auto-fills city & state"
                }
                required
              />
              <Field
                id="field-city"
                label="City"
                autoComplete="address-level2"
                value={form.city}
                onChange={set("city")}
                onBlur={blur("city")}
                error={errors.city}
                required
              />
              <SelectField
                id="field-state"
                label="State"
                autoComplete="address-level1"
                value={form.state}
                onChange={set("state")}
                onBlur={blur("state")}
                error={errors.state}
                required
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="field-country"
                label="Country"
                autoComplete="country-name"
                value={form.country}
                onChange={set("country")}
                onBlur={blur("country")}
                error={errors.country}
                required
              >
                <option value="India">India</option>
              </SelectField>
            </div>
          </Section>

          <Section title="Delivery" index="03" complete>
            <button
              type="button"
              onClick={() => setShippingMethod("standard")}
              className={cn(
                "group w-full border px-4 py-3.5 text-left transition-all duration-200 ease-expo",
                shippingMethod === "standard"
                  ? "border-ink bg-pearl/80 shadow-[inset_3px_0_0_0_#c4a574]"
                  : "border-ink/15 hover:border-ink/30"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center border transition-colors duration-200",
                    shippingMethod === "standard"
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/25 text-transparent"
                  )}
                  aria-hidden
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[14px] font-medium text-ink">Standard research dispatch</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                        Assayed lot prepared and shipped within ~7 days. Tracking after payment
                        confirmation.
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] tabular-nums text-ink">
                      {shipping === 0 ? "Free" : inr.format(shipping)}
                    </p>
                  </div>
                </div>
              </div>
            </button>
            <p className="mt-3 text-[12px] text-ink-soft">
              Arrival window firms after PIN & courier assignment. Orders at{" "}
              {inr.format(FREE_SHIPPING_THRESHOLD)}+ ship complimentary.
            </p>
          </Section>

          <Section title="Why researchers trust us" index="04">
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {TRUST_LINES.map((line) => (
                <li key={line} className="flex gap-2.5 text-[13px] leading-snug text-ink-soft">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.5} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Section>

          {error ? (
            <p
              role="alert"
              className="mt-6 border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-8 space-y-3 lg:hidden">
            <PayButton total={total} submitting={submitting} valid={isValid} attempted={attempted} />
            <PaymentStrip />
          </div>
        </form>

        <aside className="h-fit border-t border-ink/10 bg-pearl/55 p-5 shadow-[0_12px_40px_-24px_rgba(17,17,17,0.35)] lg:sticky lg:top-[4.5rem] lg:border lg:border-ink/8 lg:bg-[#f7f5f1] lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-medium text-ink">Your formula</h2>
            <Link
              href="/cart"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 transition-colors hover:text-gold hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Edit bag
            </Link>
          </div>

          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            Assay verified · SKUAST-K research · Lot prepared at dispatch
          </p>

          <ul className="mt-5 space-y-4">
            {items.map((i) => (
              <li key={i.productId} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-paper">
                  {i.imageUrl ? (
                    <Image
                      src={i.imageUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-contain p-1"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{i.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    {i.quantity} × {i.sizeLabel}
                    <span className="text-gold"> · </span>
                    Patent-backed
                  </p>
                </div>
                <p className="shrink-0 text-[13px] tabular-nums text-ink">
                  <Money value={i.priceInr * i.quantity} />
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-3 border-t border-ink/10 pt-5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="tabular-nums text-ink">
                <Money value={subtotalInr} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Shipping</dt>
              <dd className="tabular-nums text-ink">
                {shipping === 0 ? "Free" : <Money value={shipping} />}
              </dd>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-4 text-[15px]">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="font-medium tabular-nums text-ink">
                <Money value={total} />
              </dd>
            </div>
          </dl>

          <ul className="mt-5 space-y-2 border-t border-ink/8 pt-4">
            {["Batch verified", "GST invoice", "Ships ~7 days", "Razorpay protected"].map((t) => (
              <li key={t} className="flex gap-2 text-[12px] text-ink-soft">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.5} />
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden space-y-3 lg:block">
            <PayButton total={total} submitting={submitting} valid={isValid} attempted={attempted} />
            <PaymentStrip />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Money({ value }: { value: number }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
        className="inline-block"
      >
        {inr.format(value)}
      </motion.span>
    </AnimatePresence>
  );
}

function CheckoutProgress({
  contactDone,
  addressDone
}: {
  contactDone: boolean;
  addressDone: boolean;
}) {
  const steps = [
    { key: "formula", label: "Formula", status: "done" as const, href: "/cart" },
    {
      key: "shipping",
      label: "Shipping",
      status: addressDone && contactDone ? ("done" as const) : ("current" as const)
    },
    { key: "payment", label: "Payment", status: "todo" as const },
    { key: "complete", label: "Complete", status: "todo" as const }
  ];

  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
      {steps.map((step, i) => (
        <li key={step.key} className="flex items-center gap-3">
          {i > 0 ? <span className="hidden h-px w-4 bg-ink/15 sm:block" aria-hidden /> : null}
          {"href" in step && step.href ? (
            <Link
              href={step.href}
              className="inline-flex items-center gap-1.5 text-ink-soft transition-colors hover:text-ink"
            >
              <StepIcon status="done" />
              {step.label}
            </Link>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 transition-colors duration-200",
                step.status === "current" && "font-medium text-ink",
                step.status === "done" && "text-ink-soft",
                step.status === "todo" && "text-ink-mute"
              )}
            >
              <StepIcon status={step.status} />
              {step.label}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ status }: { status: "done" | "current" | "todo" }) {
  if (status === "done") {
    return (
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
        className="grid h-4 w-4 place-items-center rounded-full bg-ink text-paper"
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </motion.span>
    );
  }
  if (status === "current") {
    return (
      <span className="relative grid h-4 w-4 place-items-center">
        <Circle className="h-4 w-4 text-gold" strokeWidth={2} />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-gold" />
      </span>
    );
  }
  return <Circle className="h-3.5 w-3.5 text-ink/25" strokeWidth={1.5} />;
}

function PayButton({
  total,
  submitting,
  valid,
  attempted
}: {
  total: number;
  submitting: boolean;
  valid: boolean;
  attempted: boolean;
}) {
  const skipPayment = process.env.NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT === "true";

  return (
    <div>
      {skipPayment ? (
        <p className="mb-2 border border-gold/40 bg-pearl/80 px-3 py-2 text-center text-[12px] text-ink">
          Test mode — Razorpay is off. Orders complete without payment.
        </p>
      ) : null}
      <button
        type="submit"
        form="checkout-form"
        disabled={submitting}
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden bg-ink py-[1.125rem] text-[13px] font-medium text-paper shadow-[0_8px_24px_-12px_rgba(17,17,17,0.55)] transition-[transform,box-shadow] duration-200 ease-expo hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-14px_rgba(17,17,17,0.55)] disabled:cursor-wait disabled:hover:translate-y-0"
      >
        <span className="absolute inset-0 origin-left scale-x-0 bg-gold transition-transform duration-500 ease-expo group-hover:scale-x-100 group-disabled:scale-x-0" />
        <span className="relative z-10 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
          {submitting
            ? skipPayment
              ? "Placing test order…"
              : "Opening secure payment…"
            : skipPayment
              ? `Complete test order · ${inr.format(total)}`
              : `Pay ${inr.format(total)} securely`}
        </span>
      </button>
      {attempted && !valid ? (
        <p className="mt-2 text-center text-[12px] text-red-700">
          Complete the highlighted fields to continue.
        </p>
      ) : (
        <p className="mt-2 text-center text-[12px] text-ink-soft">No hidden fees · Encrypted</p>
      )}
    </div>
  );
}

function PaymentStrip() {
  const methods = [
    { label: "Razorpay", icon: Lock },
    { label: "UPI", icon: Smartphone },
    { label: "Cards", icon: CreditCard },
    { label: "Wallets", icon: Wallet }
  ] as const;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-ink-soft">
      {methods.map(({ label, icon: Icon }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-ink-mute" strokeWidth={1.75} />
          {label}
        </span>
      ))}
    </div>
  );
}

function Section({
  title,
  index,
  complete,
  children
}: {
  title: string;
  index: string;
  complete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink/10 py-8 first:border-t-0 first:pt-1 md:py-9">
      <div className="mb-5 flex items-baseline gap-3">
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums transition-colors duration-200",
            complete ? "text-gold" : "text-ink/30"
          )}
        >
          {complete ? (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              {index}
            </span>
          ) : (
            index
          )}
        </span>
        <h2 className="text-[1.05rem] font-medium tracking-tight text-ink md:text-[1.125rem]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

const fieldShell =
  "w-full border bg-pearl/60 px-3.5 py-2.5 text-[14px] text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-expo hover:border-ink/35 hover:bg-paper focus:border-ink focus:bg-paper focus:shadow-[0_0_0_1px_rgba(17,17,17,0.35)]";

function Field({
  label,
  className,
  error,
  hint,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span
        className={cn(
          "mb-1.5 block text-[12px]",
          error ? "font-medium text-red-700" : "text-ink-soft"
        )}
      >
        {label}
      </span>
      <input
        id={id}
        {...props}
        aria-invalid={Boolean(error)}
        className={cn(
          fieldShell,
          error
            ? "border-red-500 bg-red-50/50 focus:border-red-600 focus:shadow-[0_0_0_1px_rgba(220,38,38,0.45)]"
            : "border-ink/22"
        )}
      />
      {error ? (
        <span className="mt-1.5 block text-[12px] text-red-700">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] text-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  className,
  error,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span
        className={cn(
          "mb-1.5 block text-[12px]",
          error ? "font-medium text-red-700" : "text-ink-soft"
        )}
      >
        {label}
      </span>
      <div className="relative">
        <select
          id={id}
          {...props}
          aria-invalid={Boolean(error)}
          className={cn(
            fieldShell,
            "appearance-none pr-10",
            error
              ? "border-red-500 bg-red-50/50 focus:border-red-600 focus:shadow-[0_0_0_1px_rgba(220,38,38,0.45)]"
              : "border-ink/22"
          )}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
      {error ? <span className="mt-1.5 block text-[12px] text-red-700">{error}</span> : null}
    </label>
  );
}
