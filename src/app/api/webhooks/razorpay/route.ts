import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { markOrderFailed, markOrderPaid } from "@/modules/shop/services/order.service";
import { assertCapturedPayment, verifyWebhookSignature } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount?: number;
        currency?: string;
      };
    };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
  };
};

async function findOrderByRazorpayOrderId(razorpayOrderId: string | undefined) {
  if (!razorpayOrderId) return null;
  return db.order.findFirst({ where: { razorpayOrderId } });
}

/** Deterministic idempotency key — never use randomUUID (breaks retries). */
function resolveEventId(
  headerId: string | null,
  eventType: string,
  paymentId?: string,
  refundId?: string
): string | null {
  if (headerId?.trim()) return headerId.trim();
  if (paymentId) return `${eventType}:${paymentId}`;
  if (refundId) return `${eventType}:${refundId}`;
  return null;
}

const MAX_WEBHOOK_BYTES = 8192;

export async function POST(request: Request) {
  // Reject oversized bodies before HMAC work — payment webhooks are tiny (audit MED-02).
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    logger.warn(
      { event: "razorpay_webhook_too_large", contentLength },
      "rejected razorpay webhook exceeding size limit"
    );
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  const raw = await request.text();
  if (raw.length > MAX_WEBHOOK_BYTES) {
    logger.warn(
      { event: "razorpay_webhook_too_large", bytes: raw.length },
      "rejected razorpay webhook exceeding size limit"
    );
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    logger.warn({ event: "razorpay_webhook_bad_signature" }, "rejected razorpay webhook with invalid signature");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(raw) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = event.event ?? "unknown";
  const paymentEntity = event.payload?.payment?.entity;
  const refundEntity = event.payload?.refund?.entity;
  const eventId = resolveEventId(
    request.headers.get("x-razorpay-event-id"),
    eventType,
    paymentEntity?.id,
    refundEntity?.id
  );

  if (!eventId) {
    logger.warn({ event: "razorpay_webhook_missing_event_id", eventType }, "webhook missing stable event id");
    return NextResponse.json({ ok: false, error: "missing_event_id" }, { status: 400 });
  }

  // ── Capture / order.paid handling ──────────────────────────────────────────

  const needsCaptureFulfillment =
    eventType === "payment.captured" || eventType === "order.paid";

  if (needsCaptureFulfillment) {
    const order = await findOrderByRazorpayOrderId(paymentEntity?.order_id);

    if (!order) {
      logger.warn({ event: "razorpay_webhook_no_order", eventType }, "webhook received for unknown order");
      // Record event for observability even without an order.
      await recordEventSafe(eventId, eventType, null, event);
      return NextResponse.json({ ok: true });
    }

    // ── P-01 FIX: Check existing PaymentEvent for idempotency ───────────────
    // Key change: we check processedAt to distinguish fully-processed from incomplete.
    const existingEvent = await db.paymentEvent.findUnique({
      where: { providerEventId: eventId }
    });

    if (existingEvent?.processedAt) {
      // Fully processed — just ack.
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (existingEvent && !existingEvent.processedAt) {
      // Event was recorded but fulfillment incomplete (prior 500).
      // Re-drive fulfillment, then mark processed.
      const fresh = await db.order.findUnique({
        where: { id: order.id },
        select: { status: true, stockDeducted: true }
      });

      const alreadyFulfilled =
        fresh &&
        fresh.stockDeducted &&
        ["paid", "processing", "shipped", "delivered", "refunded", "partially_refunded"].includes(fresh.status);

      if (alreadyFulfilled) {
        // Fulfillment must have completed via another path — stamp processedAt.
        await db.paymentEvent
          .update({ where: { id: existingEvent.id }, data: { processedAt: new Date() } })
          .catch(() => undefined);
        return NextResponse.json({ ok: true, duplicate: true });
      }

      // Not yet fulfilled — re-drive.
      return await fulfillAndRecord(order, paymentEntity, eventId, existingEvent.id, event);
    }

    // ── No existing event: first attempt ─────────────────────────────────────

    const paymentId = paymentEntity?.id;
    if (!paymentId || !order.razorpayOrderId) {
      logger.error({ orderId: order.id, event: "webhook_missing_payment_id" }, "capture webhook missing payment id");
      return NextResponse.json({ ok: false, retry: true }, { status: 500 });
    }

    // P-04: Assert payment is truly captured with correct amount via Razorpay API.
    const asserted = await assertCapturedPayment({
      paymentId,
      razorpayOrderId: order.razorpayOrderId,
      amountCents: order.totalCents
    });
    if (!asserted.ok) {
      logger.error(
        { orderId: order.id, error: asserted.error, event: "webhook_amount_assert_failed" },
        "webhook payment assertion failed"
      );
      // 400 = do not retry forever on permanent mismatches.
      return NextResponse.json({ ok: false, error: asserted.error }, { status: 400 });
    }

    // Attempt fulfillment FIRST, then record event (P-01 fix).
    return await fulfillAndRecord(order, paymentEntity, eventId, null, event);
  }

  // ── Payment failed ─────────────────────────────────────────────────────────

  if (eventType === "payment.failed") {
    const order = await findOrderByRazorpayOrderId(paymentEntity?.order_id);
    if (order) {
      await markOrderFailed({ orderId: order.id, source: "webhook" });
    }
    await recordEventSafe(eventId, eventType, order?.id ?? null, event);
    return NextResponse.json({ ok: true });
  }

  // ── P-07: Refund webhooks ──────────────────────────────────────────────────

  if (eventType === "refund.created" || eventType === "refund.processed") {
    return await handleRefundWebhook(eventId, eventType, event);
  }

  // ── Unknown event type — ack to prevent retries ────────────────────────────

  await recordEventSafe(eventId, eventType, null, event);
  return NextResponse.json({ ok: true });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * P-01 core fix: Run fulfillment first, THEN record PaymentEvent.
 * If fulfillment fails → return 500 → NO PaymentEvent → Razorpay retries from scratch.
 * If fulfillment succeeds → record event with processedAt → subsequent retries get {duplicate:true}.
 */
async function fulfillAndRecord(
  order: { id: string; razorpayOrderId: string | null },
  paymentEntity: { id?: string; order_id?: string; status?: string; amount?: number; currency?: string } | undefined,
  eventId: string,
  existingEventId: string | null,
  rawEvent: RazorpayWebhook
) {
  const paymentId = paymentEntity?.id;
  const eventType = rawEvent.event ?? "unknown";

  try {
    const paid = await markOrderPaid({
      orderId: order.id,
      razorpayPaymentId: paymentId,
      source: existingEventId ? "webhook_redrive" : "webhook"
    });
    if (!paid.ok) {
      logger.error(
        { orderId: order.id, eventType, event: "webhook_fulfillment_failed" },
        "webhook capture fulfillment failed — will retry"
      );
      return NextResponse.json({ ok: false, retry: true }, { status: 500 });
    }
  } catch (err) {
    logger.error({ err, orderId: order.id, event: "webhook_fulfillment_error" }, "markOrderPaid threw");
    return NextResponse.json({ ok: false, retry: true }, { status: 500 });
  }

  // Fulfillment succeeded — now record/update the PaymentEvent with processedAt via upsert
  try {
    await db.paymentEvent.upsert({
      where: { providerEventId: eventId },
      create: {
        eventType,
        providerEventId: eventId,
        orderId: order.id,
        signatureValid: true,
        payload: rawEvent as unknown as object,
        processedAt: new Date()
      },
      update: {
        processedAt: new Date(),
        orderId: order.id
      }
    });
  } catch (err) {
    logger.error({ err, eventId, orderId: order.id, event: "payment_event_record_error" }, "failed to stamp paymentEvent processedAt");
  }

  return NextResponse.json({ ok: true });
}

/**
 * P-07: Handle refund.created / refund.processed webhooks.
 * Business logic runs only on refund.processed; refund.id is deduped via OrderRefund.
 */
async function handleRefundWebhook(
  eventId: string,
  eventType: string,
  rawEvent: RazorpayWebhook
) {
  const refundEntity = rawEvent.payload?.refund?.entity;
  const paymentEntity = rawEvent.payload?.payment?.entity;
  const refundAmountCents = refundEntity?.amount;
  const razorpayRefundId = refundEntity?.id;
  const razorpayPaymentId = refundEntity?.payment_id ?? paymentEntity?.id;

  const existingEvent = await db.paymentEvent.findUnique({
    where: { providerEventId: eventId }
  });
  if (existingEvent?.processedAt) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Ack refund.created without mutating order totals.
  if (eventType === "refund.created") {
    await recordEventSafe(eventId, eventType, null, rawEvent);
    return NextResponse.json({ ok: true });
  }

  if (
    !razorpayRefundId ||
    !razorpayPaymentId ||
    typeof refundAmountCents !== "number" ||
    refundAmountCents <= 0
  ) {
    logger.warn(
      { event: "refund_webhook_invalid", eventType, refundEntity },
      "refund webhook missing refund id, payment_id, or amount"
    );
    await recordEventSafe(eventId, eventType, null, rawEvent);
    return NextResponse.json({ ok: true });
  }

  const order = await db.order.findFirst({
    where: { razorpayPaymentId },
    select: { id: true }
  });
  if (!order) {
    logger.warn(
      { event: "refund_webhook_no_order", razorpayPaymentId },
      "refund webhook: no order found for payment"
    );
    await recordEventSafe(eventId, eventType, null, rawEvent);
    return NextResponse.json({ ok: true });
  }

  const { verifyRazorpayRefund } = await import("@/lib/payments/razorpay");
  const verified = await verifyRazorpayRefund({
    refundId: razorpayRefundId,
    expectedAmountCents: refundAmountCents
  });
  if (!verified.ok) {
    logger.error({ event: "refund_webhook_verify_failed", razorpayRefundId, error: verified.error }, "refund verification against Razorpay API failed");
    return NextResponse.json({ ok: false, error: verified.error }, { status: 400 });
  }

  const { applyOrderRefund } = await import("@/modules/shop/services/refund.service");
  const result = await applyOrderRefund({
    orderId: order.id,
    razorpayRefundId,
    amountCents: refundAmountCents,
    source: "webhook",
    restock: true,
    eventType: "refund_processed"
  });

  if (!result.ok) {
    logger.error({ event: "refund_apply_failed", orderId: order.id, result }, "refund webhook apply failed");
    return NextResponse.json({ ok: false, retry: true }, { status: 500 });
  }

  try {
    await db.paymentEvent.upsert({
      where: { providerEventId: eventId },
      create: {
        eventType,
        providerEventId: eventId,
        orderId: order.id,
        signatureValid: true,
        payload: rawEvent as unknown as object,
        processedAt: new Date()
      },
      update: {
        processedAt: new Date(),
        orderId: order.id
      }
    });
  } catch (err) {
    logger.error({ err, eventId, orderId: order.id, event: "refund_event_record_error" }, "failed to stamp refund paymentEvent processedAt");
  }

  return NextResponse.json({ ok: true, duplicate: result.duplicate });
}

/** Record a PaymentEvent without processedAt (for non-fulfillment events like payment.failed). */
async function recordEventSafe(
  eventId: string,
  eventType: string,
  orderId: string | null,
  rawEvent: RazorpayWebhook
) {
  try {
    await db.paymentEvent.upsert({
      where: { providerEventId: eventId },
      create: {
        eventType,
        providerEventId: eventId,
        orderId,
        signatureValid: true,
        payload: rawEvent as unknown as object,
        processedAt: new Date()
      },
      update: {
        processedAt: new Date(),
        orderId: orderId ?? undefined
      }
    });
  } catch {
    // Concurrent duplicate — safe.
  }
}
