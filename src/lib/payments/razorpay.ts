import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

const RZP_API = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayPublicKey(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
}

type CreateOrderInput = {
  amountCents: number;
  receipt: string;
  notes?: Record<string, string>;
};

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string };

/** Creates a Razorpay order via the REST API. Amount must be server-calculated (in paise/cents). */
export async function createRazorpayOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured.");

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${RZP_API}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: "INR",
        receipt: input.receipt,
        notes: input.notes ?? {}
      }),
      signal: controller.signal
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      logger.error({ event: "razorpay_order_failed", status: res.status, body: json }, "Razorpay order create failed");
      throw new Error(json?.error?.description ?? "Failed to create payment order.");
    }
    return json as RazorpayOrder;
  } finally {
    clearTimeout(timeout);
  }
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Verifies the checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}

/** Verifies a webhook payload against the webhook secret (distinct from the API key secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export type RazorpayPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
};

/** Fetches a payment and asserts it is captured for the expected Razorpay order + amount. */
export async function assertCapturedPayment(input: {
  paymentId: string;
  razorpayOrderId: string;
  amountCents: number;
}): Promise<{ ok: true; payment: RazorpayPayment } | { ok: false; error: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return { ok: false, error: "Razorpay is not configured." };

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${RZP_API}/payments/${encodeURIComponent(input.paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal
    });
    const json = (await res.json().catch(() => null)) as RazorpayPayment | null;
    if (!res.ok || !json) {
      logger.error({ event: "razorpay_payment_fetch_failed", status: res.status, body: json }, "payment fetch failed");
      return { ok: false, error: "Could not confirm payment with Razorpay." };
    }
    if (json.order_id !== input.razorpayOrderId) {
      return { ok: false, error: "Payment does not match this order." };
    }
    if (json.status !== "captured") {
      return { ok: false, error: `Payment status is ${json.status}.` };
    }
    if (json.currency !== "INR") {
      logger.error({ event: "razorpay_currency_mismatch", expected: "INR", actual: json.currency, paymentId: input.paymentId }, "payment currency mismatch");
      return { ok: false, error: "Payment currency must be INR." };
    }
    if (Number(json.amount) !== input.amountCents) {
      logger.error(
        {
          event: "razorpay_amount_mismatch",
          expected: input.amountCents,
          actual: json.amount,
          paymentId: input.paymentId
        },
        "payment amount mismatch"
      );
      return { ok: false, error: "Payment amount does not match order total." };
    }
    return { ok: true, payment: json };
  } finally {
    clearTimeout(timeout);
  }
}

/** Issues a Razorpay refund against a captured payment (amount in paise). */
export type RazorpayRefund = { id: string; amount: number; currency?: string; status: string; payment_id: string };

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountCents?: number;
  notes?: Record<string, string>;
}): Promise<RazorpayRefund> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured.");

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const body: Record<string, unknown> = { notes: input.notes ?? {} };
  if (typeof input.amountCents === "number" && input.amountCents > 0) {
    body.amount = input.amountCents;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${RZP_API}/payments/${encodeURIComponent(input.paymentId)}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      logger.error({ event: "razorpay_refund_failed", status: res.status, body: json }, "Razorpay refund failed");
      throw new Error(json?.error?.description ?? "Failed to create refund.");
    }
    return json as RazorpayRefund;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches a refund from Razorpay API and asserts amount/status/currency (REF-16). */
export async function verifyRazorpayRefund(input: {
  refundId: string;
  expectedAmountCents?: number;
}): Promise<{ ok: true; refund: RazorpayRefund } | { ok: false; error: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return { ok: false, error: "Razorpay is not configured." };

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${RZP_API}/refunds/${encodeURIComponent(input.refundId)}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal
    });
    const json = (await res.json().catch(() => null)) as RazorpayRefund | null;
    if (!res.ok || !json) {
      logger.error({ event: "razorpay_refund_fetch_failed", status: res.status, body: json }, "refund fetch failed");
      return { ok: false, error: "Could not confirm refund with Razorpay." };
    }
    if (json.currency && json.currency !== "INR") {
      return { ok: false, error: "Refund currency must be INR." };
    }
    if (typeof input.expectedAmountCents === "number" && Number(json.amount) !== input.expectedAmountCents) {
      logger.error(
        {
          event: "razorpay_refund_amount_mismatch",
          expected: input.expectedAmountCents,
          actual: json.amount,
          refundId: input.refundId
        },
        "refund amount mismatch"
      );
      return { ok: false, error: "Refund amount does not match expected amount." };
    }
    return { ok: true, refund: json };
  } finally {
    clearTimeout(timeout);
  }
}
