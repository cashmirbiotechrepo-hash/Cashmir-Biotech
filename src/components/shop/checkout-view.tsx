"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CreditCard,
  FlaskConical,
  Lock,
  Mail,
  Smartphone,
  Truck,
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
type StepId = "contact" | "delivery";

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

function shipsByLabel() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
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
  prefillEmail = "",
  flatShippingInr = 60,
  freeShippingThresholdInr = 999
}: {
  savedAddresses?: SavedCheckoutAddress[];
  prefillEmail?: string;
  flatShippingInr?: number;
  freeShippingThresholdInr?: number;
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
  const [openStep, setOpenStep] = useState<StepId>("contact");

  const shipsBy = useMemo(() => shipsByLabel(), []);

  useEffect(() => {
    if (ready && items.length === 0 && !submitting) {
      router.replace("/cart");
    }
  }, [ready, items.length, submitting, router]);

  const shipping = subtotalInr >= freeShippingThresholdInr ? 0 : flatShippingInr;
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

  useEffect(() => {
    if (contactDone && openStep === "contact" && !addressDone) {
      // keep contact open until they continue
    }
  }, [contactDone, addressDone, openStep]);

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
      "postalCode",
      "line1",
      "city",
      "state",
      "country"
    ];
    const first = order.find((k) => errs[k]);
    if (!first) return;
    if (["email", "phone"].includes(first)) setOpenStep("contact");
    else setOpenStep("delivery");
    window.setTimeout(() => {
      const el = document.getElementById(`field-${first}`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
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
        prefill: {
          name: data.customer?.name,
          email: data.customer?.email,
          contact: data.customer?.phone
        },
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
      <div className="mx-auto max-w-lg px-5 pt-8">
        <div className="h-48 animate-pulse bg-pearl/80" />
      </div>
    );
  }

  const primary = items[0];
  const moreCount = Math.max(0, items.length - 1);

  return (
    <div className="relative min-h-dvh bg-ivory pb-28 lg:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% -10%, rgb(184 148 88 / 0.12), transparent 55%)"
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/cart"
              className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-ink-mute hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Edit bag
            </Link>
            <p className="mt-3 text-[13px] font-medium text-gold">Cashmir Biotech</p>
            <h1 className="mt-1 max-w-[18ch] text-[1.65rem] font-light leading-[1.12] tracking-tight text-ink sm:text-[2rem]">
              One step from laboratory-grade wellness.
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-mute">
              Secure your patented formulation. GST invoice and batch records included.
            </p>
          </div>
        </header>

        <StepCapsules contactDone={contactDone} addressDone={addressDone} openStep={openStep} />

        <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-start lg:gap-10">
          <form id="checkout-form" onSubmit={handleSubmit} noValidate className="space-y-3">
            {/* Product lead — mobile first */}
            <section className="border border-ink/10 bg-paper p-4 lg:hidden">
              <div className="flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-pearl">
                  {primary?.imageUrl ? (
                    <Image
                      src={primary.imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-contain p-1.5"
                      priority
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-ink-faint">
                      <FlaskConical className="h-7 w-7" strokeWidth={1.25} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">
                    {primary?.name ?? "Your formula"}
                    {moreCount > 0 ? ` +${moreCount}` : ""}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-mute">
                    {primary ? `${primary.quantity} × ${primary.sizeLabel}` : null}
                    <span className="text-gold"> · </span>
                    Patent-backed
                  </p>
                  <p className="mt-2 text-[13px] text-ink-mute">
                    Ships by <span className="font-medium text-ink">{shipsBy}</span>
                  </p>
                  <p className="mt-1 text-[18px] font-light tabular-nums text-ink">
                    {inr.format(total)}
                  </p>
                </div>
              </div>
            </section>

            <Accordion
              step="contact"
              index="01"
              title="Contact"
              open={openStep === "contact"}
              done={contactDone}
              summary={
                contactDone
                  ? `${form.email}${form.phone ? ` · ${form.phone}` : ""}`
                  : "Email & mobile for updates"
              }
              onOpen={() => setOpenStep("contact")}
            >
              <div className="grid gap-3.5">
                <Field
                  id="field-email"
                  label="Email"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={form.email}
                  onChange={set("email")}
                  onBlur={blur("email")}
                  error={errors.email}
                  hint="Order confirmation and GST invoice"
                  required
                />
                <Field
                  id="field-phone"
                  label="Mobile"
                  icon={Smartphone}
                  autoComplete="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={set("phone")}
                  onBlur={blur("phone")}
                  error={errors.phone}
                  hint="Only used for delivery OTP and courier updates"
                  required
                />
                <button
                  type="button"
                  disabled={!contactDone}
                  onClick={() => setOpenStep("delivery")}
                  className="mt-1 w-full min-h-12 bg-ink text-[14px] font-medium text-paper disabled:bg-ink/25"
                >
                  Continue to delivery
                </button>
              </div>
            </Accordion>

            <Accordion
              step="delivery"
              index="02"
              title="Delivery"
              open={openStep === "delivery"}
              done={addressDone}
              summary={
                addressDone
                  ? `${form.fullName} · ${form.city}, ${form.state} ${form.postalCode}`
                  : "Where we ship your lot"
              }
              onOpen={() => setOpenStep("delivery")}
            >
              {savedAddresses.length > 0 ? (
                <div className="mb-4 space-y-2">
                  <p className="text-[12px] font-medium text-ink-mute">Saved addresses</p>
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
                        className="border border-ink/12 bg-ivory px-3 py-2 text-left text-[12px] text-ink active:bg-pearl"
                      >
                        <span className="font-medium">{a.label}</span>
                        {a.isDefault ? <span className="ml-1 text-gold">default</span> : null}
                        <span className="mt-0.5 block text-ink-mute">
                          {a.city}, {a.state}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3.5 sm:grid-cols-2">
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
                  id="field-fullName"
                  label="Full name"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={set("fullName")}
                  onBlur={blur("fullName")}
                  error={errors.fullName}
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
                  className="sm:col-span-2"
                  required
                >
                  <option value="India">India</option>
                </SelectField>
              </div>

              <div className="mt-4 flex gap-3 border border-ink/10 bg-ivory p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center bg-paper text-ink">
                  <Truck className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-medium text-ink">Standard research dispatch</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-ink-mute">
                        Assayed lot ships by <span className="text-ink">{shipsBy}</span>. Tracking after
                        payment.
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-medium tabular-nums text-ink">
                      {shipping === 0 ? "Free" : inr.format(shipping)}
                    </p>
                  </div>
                  {shipping > 0 ? (
                    <p className="mt-2 text-[11px] text-ink-mute">
                      Free shipping on {inr.format(freeShippingThresholdInr)}+
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] font-medium text-gold">Complimentary shipping unlocked</p>
                  )}
                </div>
              </div>
            </Accordion>

            <section className="border border-ink/10 bg-paper px-4 py-4">
              <p className="text-[12px] font-medium text-ink-mute">Before you pay</p>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {[
                  "SSL encrypted checkout",
                  "Razorpay protected",
                  "GST invoice auto-generated",
                  "Batch verified before dispatch"
                ].map((line) => (
                  <li key={line} className="flex gap-2 text-[13px] text-ink">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.5} />
                    {line}
                  </li>
                ))}
              </ul>
              <PaymentStrip className="mt-4 justify-start" />
            </section>

            {error ? (
              <p
                role="alert"
                className="border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-800"
              >
                {error}
              </p>
            ) : null}

            {/* Desktop CTA (sticky aside also has one) */}
            <div className="hidden lg:block">
              <PayButton total={total} submitting={submitting} valid={isValid} attempted={attempted} />
            </div>
          </form>

          <aside className="hidden h-fit border border-ink/10 bg-paper p-5 lg:sticky lg:top-24 lg:block lg:p-6">
            <h2 className="text-[13px] font-medium text-ink-mute">Your formula</h2>
            <ul className="mt-4 space-y-4">
              {items.map((i) => (
                <li key={i.productId} className="flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-pearl">
                    {i.imageUrl ? (
                      <Image src={i.imageUrl} alt="" fill sizes="80px" className="object-contain p-1.5" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-snug text-ink">{i.name}</p>
                    <p className="mt-1 text-[12px] text-ink-mute">
                      {i.quantity} × {i.sizeLabel}
                      <span className="text-gold"> · </span>
                      Patent-backed
                    </p>
                    <p className="mt-2 text-[12px] text-ink-mute">Ships by {shipsBy}</p>
                  </div>
                  <p className="shrink-0 text-[14px] tabular-nums text-ink">
                    <Money value={i.priceInr * i.quantity} />
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2.5 border-t border-ink/10 pt-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-mute">Subtotal</dt>
                <dd className="tabular-nums">
                  <Money value={subtotalInr} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-mute">Shipping</dt>
                <dd className="tabular-nums">
                  {shipping === 0 ? "Free" : <Money value={shipping} />}
                </dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-3 text-[1.35rem] font-light">
                <dt className="text-ink">Total</dt>
                <dd className="tabular-nums text-ink">
                  <Money value={total} />
                </dd>
              </div>
            </dl>

            <ul className="mt-5 space-y-2 border-t border-ink/8 pt-4">
              {["Batch verified", "GST invoice", `Ships by ${shipsBy}`, "Razorpay protected"].map(
                (t) => (
                  <li key={t} className="flex gap-2 text-[12px] text-ink-mute">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.5} />
                    {t}
                  </li>
                )
              )}
            </ul>

            <div className="mt-5">
              <PayButton total={total} submitting={submitting} valid={isValid} attempted={attempted} />
              <PaymentStrip className="mt-3" />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky pay dock */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] text-ink-mute">Total</p>
            <p className="text-[1.25rem] font-light tabular-nums leading-none text-ink">
              <Money value={total} />
            </p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={submitting}
            className="flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 bg-ink px-4 text-[14px] font-medium text-paper shadow-[0_10px_28px_-14px_rgba(17,17,17,0.7)] disabled:opacity-60"
          >
            <Lock className="h-4 w-4" strokeWidth={2} />
            {submitting ? "Opening payment…" : "Complete secure purchase"}
          </button>
        </div>
        {attempted && !isValid ? (
          <p className="px-4 pb-2 text-center text-[11px] text-red-700">
            Complete the highlighted fields to continue.
          </p>
        ) : null}
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

function StepCapsules({
  contactDone,
  addressDone,
  openStep
}: {
  contactDone: boolean;
  addressDone: boolean;
  openStep: StepId;
}) {
  const steps: Array<{ id: StepId | "pay"; label: string; done: boolean; active: boolean }> = [
    {
      id: "contact",
      label: "Contact",
      done: contactDone,
      active: openStep === "contact"
    },
    {
      id: "delivery",
      label: "Delivery",
      done: addressDone,
      active: openStep === "delivery"
    },
    {
      id: "pay",
      label: "Payment",
      done: false,
      active: contactDone && addressDone
    }
  ];

  return (
    <ol className="mt-5 flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <li
          key={s.id}
          className={cn(
            "inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-[12px]",
            s.done
              ? "border-ink/15 bg-paper text-ink"
              : s.active
                ? "border-ink bg-ink text-paper"
                : "border-ink/10 text-ink-mute"
          )}
        >
          <span className="tabular-nums opacity-70">0{i + 1}</span>
          {s.done ? <Check className="h-3 w-3 text-gold" strokeWidth={2.5} /> : null}
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function Accordion({
  index,
  title,
  open,
  done,
  summary,
  onOpen,
  children
}: {
  step: StepId;
  index: string;
  title: string;
  open: boolean;
  done?: boolean;
  summary: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-ink/10 bg-paper">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center text-[11px] font-medium",
            done ? "bg-ink text-paper" : open ? "bg-gold text-ink" : "bg-pearl text-ink-mute"
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink">{title}</span>
          {!open ? (
            <span className="mt-0.5 block truncate text-[12px] text-ink-mute">{summary}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink/8 px-4 pb-4 pt-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
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
        className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 bg-ink text-[15px] font-medium text-paper shadow-[0_10px_28px_-14px_rgba(17,17,17,0.55)] transition-transform hover:-translate-y-px disabled:cursor-wait disabled:hover:translate-y-0"
      >
        <Lock className="h-4 w-4" strokeWidth={2} />
        {submitting
          ? skipPayment
            ? "Placing test order…"
            : "Opening secure payment…"
          : skipPayment
            ? `Complete test order · ${inr.format(total)}`
            : `Complete secure purchase · ${inr.format(total)}`}
      </button>
      {attempted && !valid ? (
        <p className="mt-2 text-center text-[12px] text-red-700">
          Complete the highlighted fields to continue.
        </p>
      ) : (
        <p className="mt-2 text-center text-[12px] text-ink-mute">UPI · Cards · Wallets via Razorpay</p>
      )}
    </div>
  );
}

function PaymentStrip({ className }: { className?: string }) {
  const methods = [
    { label: "Razorpay", icon: Lock },
    { label: "UPI", icon: Smartphone },
    { label: "Cards", icon: CreditCard },
    { label: "Wallets", icon: Wallet }
  ] as const;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-ink-mute",
        className
      )}
    >
      {methods.map(({ label, icon: Icon }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <Icon className="h-3 w-3" strokeWidth={1.75} />
          {label}
        </span>
      ))}
    </div>
  );
}

const fieldShell =
  "w-full border bg-paper px-3.5 py-3 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(184,148,88,0.22)]";

function Field({
  label,
  className,
  error,
  hint,
  id,
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <label className={cn("block", className)}>
      <span
        className={cn(
          "mb-1.5 block text-[13px] font-medium",
          error ? "text-red-700" : "text-ink"
        )}
      >
        {label}
      </span>
      <span className="relative block">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
            strokeWidth={1.75}
          />
        ) : null}
        <input
          id={id}
          {...props}
          aria-invalid={Boolean(error)}
          className={cn(
            fieldShell,
            Icon && "pl-10",
            error
              ? "border-red-500 bg-red-50/40 focus:border-red-600 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.15)]"
              : "border-ink/15"
          )}
        />
      </span>
      {error ? (
        <span className="mt-1.5 block text-[12px] text-red-700">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] text-ink-mute">{hint}</span>
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
          "mb-1.5 block text-[13px] font-medium",
          error ? "text-red-700" : "text-ink"
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
              ? "border-red-500 bg-red-50/40 focus:border-red-600"
              : "border-ink/15"
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
