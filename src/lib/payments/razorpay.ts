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
