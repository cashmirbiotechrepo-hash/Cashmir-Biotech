import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

/**
 * Enqueue a post-payment task for async processing.
 * Called from markOrderPaid after the durable payment receipt is committed.
 */
export async function enqueuePostPaymentTask(orderId: string) {
  try {
    const existing = await db.orderTask.findFirst({
      where: { orderId, type: "post_payment" }
    });
    if (existing) return existing.id;

    const task = await db.orderTask.create({
      data: {
        orderId,
        type: "post_payment",
        status: "pending"
      }
    });
    return task.id;
  } catch (err) {
    // Unique (orderId, type) race — return the winner's task id.
    const raced = await db.orderTask.findFirst({
      where: { orderId, type: "post_payment" }
    });
    if (raced) return raced.id;

    logger.error({ err, orderId, event: "outbox_enqueue_failed" }, "failed to enqueue post-payment task");
    return null;
  }
}

async function reclaimStaleProcessingTasks() {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  const reclaimed = await db.orderTask.updateMany({
    where: { status: "processing", updatedAt: { lt: cutoff } },
    data: { status: "pending" }
  });
  if (reclaimed.count > 0) {
    logger.warn(
      { count: reclaimed.count, event: "outbox_reclaim_stale" },
      "reclaimed stale outbox tasks stuck in processing"
    );
  }
}

/**
 * Atomically claim one pending/failed task. Only one worker wins per row.
 */
async function claimNextTask(): Promise<{ id: string; orderId: string; type: string; attempts: number } | null> {
  try {
    // PROJECT OMEGA / ITERATION 4 FIX: Native PostgreSQL atomic row-claiming with SKIP LOCKED
    // Eliminates write contention and lock serialization delays during high-throughput parallel cron processing.
    const claimed = await db.$queryRaw<Array<{ id: string; orderId: string; type: string; attempts: number }>>`
      UPDATE "OrderTask"
      SET status = 'processing', "updatedAt" = now()
      WHERE id = (
        SELECT id FROM "OrderTask"
        WHERE status IN ('pending', 'failed') AND attempts < ${MAX_ATTEMPTS}
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= now())
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "orderId", type, attempts
    `;
    if (claimed && claimed.length > 0 && claimed[0]) {
      return claimed[0];
    }
    return null;
  } catch {
    // Fallback for non-PostgreSQL / local SQLite test environments where FOR UPDATE SKIP LOCKED is not supported
    const candidate = await db.orderTask.findFirst({
      where: {
        status: { in: ["pending", "failed"] },
        attempts: { lt: MAX_ATTEMPTS },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }]
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, orderId: true, type: true, attempts: true }
    });
    if (!candidate) return null;

    const claimed = await db.orderTask.updateMany({
      where: { id: candidate.id, status: { in: ["pending", "failed"] } },
      data: { status: "processing" }
    });
    if (claimed.count !== 1) return null;

    return candidate;
  }
}

/**
 * Process pending outbox tasks (called by cron).
 * Claims tasks one-at-a-time to avoid duplicate workers processing the same row.
 */
export async function processOutboxBatch(batchSize = 10): Promise<{
  processed: number;
  failed: number;
  deadLettered: number;
}> {
  await reclaimStaleProcessingTasks();

  let processed = 0;
  let failed = 0;
  let deadLettered = 0;
  const startTime = Date.now();

  for (let i = 0; i < batchSize; i++) {
    // PROJECT OMEGA / MED-01 FIX: Prevent cron execution starvation & Vercel 60s maxDuration kill
    if (Date.now() - startTime > 45000) {
      logger.warn({ processed, failed, deadLettered }, "Outbox batch execution nearing timeout threshold; breaking cleanly");
      break;
    }

    const task = await claimNextTask();
    if (!task) break;

    try {
      if (task.type === "post_payment") {
        await runPostPaymentSideEffects(task.orderId);
      }
      await db.orderTask.update({
        where: { id: task.id },
        data: { status: "completed", attempts: task.attempts + 1, nextRetryAt: null }
      });
      processed++;
    } catch (err) {
      const nextAttempts = task.attempts + 1;
      const nextStatus = nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "pending";
      const errorMsg = err instanceof Error ? err.message : String(err);
      // PROJECT OMEGA / HIGH #1 & TOP-100 #4, #6 FIX: Exponential backoff delay (Math.pow(2, attempts) minutes)
      const nextRetryAt = nextStatus === "pending" ? new Date(Date.now() + Math.pow(2, task.attempts) * 60000) : null;

      await db.orderTask.update({
        where: { id: task.id },
        data: {
          status: nextStatus,
          attempts: nextAttempts,
          lastError: errorMsg.slice(0, 1000),
          nextRetryAt
        }
      });

      if (nextStatus === "dead_letter") {
        deadLettered++;
        logger.error(
          { err, orderId: task.orderId, taskId: task.id, event: "outbox_dead_letter" },
          "outbox task exhausted retries"
        );
      } else {
        failed++;
        logger.warn(
          { err, orderId: task.orderId, taskId: task.id, attempts: nextAttempts, event: "outbox_task_failed" },
          "outbox task failed — will retry"
        );
      }
    }
  }

  return { processed, failed, deadLettered };
}

/**
 * Run all post-payment side-effects for an order.
 * These were previously inline in markOrderPaid and caused webhook timeouts.
 */
async function runPostPaymentSideEffects(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { imageUrl: true, sizeLabel: true } } } }
    }
  });
  if (!order) {
    logger.warn({ orderId, event: "outbox_order_missing" }, "outbox task: order not found");
    return;
  }

  // 1. Customer attach (non-critical — catch and continue).
  if (order.customerEmail) {
    try {
      const {
        ensureCustomerFromCheckout,
        attachOrderToCustomer,
        linkGuestOrdersToCustomer
      } = await import("@/lib/customer/auth");
      const customerId = await ensureCustomerFromCheckout({
        email: order.customerEmail,
        name: order.customerName,
        phone: order.customerPhone
      });
      if (customerId) {
        await attachOrderToCustomer(order.id, customerId);
        const verified = await db.customer.findUnique({
          where: { id: customerId },
          select: { emailVerifiedAt: true }
        });
        if (verified?.emailVerifiedAt) {
          await linkGuestOrdersToCustomer(customerId, order.customerEmail);
        }
      }
    } catch (err) {
      logger.error({ err, orderId, event: "outbox_customer_attach_failed" }, "async customer attach failed");
    }
  }

  // 2. Invoice + PDF generation.
  const { ensureInvoiceForOrder, runPaidOrderAutomation, recordOrderEvent } = await import(
    "@/modules/shop/services/order-ops.service"
  );

  await runPaidOrderAutomation(orderId, "outbox").catch((err) => {
    logger.error({ err, orderId, event: "outbox_automation_failed" }, "outbox paid order automation failed");
  });

  // 3. Invoice PDF persist.
  const inv = await ensureInvoiceForOrder(orderId).catch(() => null);
  if (inv?.invoiceId) {
    try {
      const invoice = await db.invoice.findUnique({ where: { id: inv.invoiceId } });
      if (invoice) {
        const gst = (invoice.gstDetails ?? {}) as {
          gstin?: string;
          cgstCents?: number;
          sgstCents?: number;
          igstCents?: number;
          placeOfSupply?: string;
          lineItems?: Array<{ description: string; qty: number; amountCents: number }>;
        };
        const { persistInvoicePdfFile } = await import("@/modules/shop/services/invoice-persist.service");
        const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
        const tokenUrl = `${site}/api/order/${order.orderNumber}/invoice.pdf?t=${order.confirmationToken}`;

        const orderItems = await db.orderItem.findMany({ where: { orderId: order.id } });
        const persisted = await persistInvoicePdfFile(invoice.id, invoice.invoiceNumber, {
          invoiceNumber: invoice.invoiceNumber,
          issuedAt: invoice.issuedAt,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          shippingAddress: (order.shippingAddress ?? {}) as {
            fullName?: string;
            phone?: string;
            line1?: string;
            line2?: string;
            city?: string;
            state?: string;
            postalCode?: string;
          },
          lines:
            gst.lineItems?.length
              ? gst.lineItems
              : orderItems.map((item) => ({
                  description: item.productName,
                  qty: item.quantity,
                  amountCents: item.quantity * item.unitPriceCents,
                  unitPriceCents: item.unitPriceCents,
                  lot: item.lotCodes || undefined
                })),
          subtotalCents: invoice.subtotalCents,
          taxCents: invoice.taxCents,
          totalCents: invoice.totalCents,
          shippingCents: order.shippingCents,
          discountCents: order.discountCents ?? 0,
          gstin: gst.gstin,
          cgstCents: gst.cgstCents,
          sgstCents: gst.sgstCents,
          igstCents: gst.igstCents,
          placeOfSupply: gst.placeOfSupply,
          paymentStatus: "paid",
          paymentMethod: order.razorpayPaymentId?.startsWith("test_skip_") ? "Test checkout" : "Razorpay",
          razorpayPaymentId: order.razorpayPaymentId || null,
          razorpayOrderId: order.razorpayOrderId,
          paidAt: new Date(),
          confirmationToken: order.confirmationToken
        });
        if (!persisted) {
          await db.invoice.update({ where: { id: inv.invoiceId }, data: { pdfUrl: tokenUrl } }).catch(() => undefined);
        }
      }
    } catch (err) {
      logger.error({ err, orderId, event: "outbox_invoice_pdf_failed" }, "outbox invoice PDF persist failed");
    }
  }

  // 4. Confirmation email (idempotent — skip if already sent).
  const emailAlreadySent = await db.orderEvent.findFirst({
    where: { orderId, type: "confirmation_email_sent" },
    select: { id: true }
  });

  if (order.customerEmail && !emailAlreadySent) {
    try {
      const { buildOrderConfirmedMail } = await import("@/lib/email/transactional");
      const { sendTransactionalMail } = await import("@/lib/admin/mail");
      const addr = (order.shippingAddress ?? null) as {
        fullName?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        phone?: string;
      } | null;
      const mail = buildOrderConfirmedMail({
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        confirmationToken: order.confirmationToken,
        items: order.items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          imageUrl: i.product?.imageUrl,
          sizeLabel: i.product?.sizeLabel
        })),
        shippingAddress: addr,
        shippingCents: order.shippingCents,
        discountCents: order.discountCents ?? 0,
        totalCents: order.totalCents
      });
      await sendTransactionalMail({ to: order.customerEmail, mail });
      await recordOrderEvent({
        orderId,
        type: "confirmation_email_sent",
        title: "Order confirmation email sent",
        detail: order.customerEmail
      });
    } catch (err) {
      logger.error({ err, orderId, event: "outbox_email_failed" }, "outbox confirmation email failed");
      throw err;
    }
  }

  // 5. Record payment confirmation event (idempotent).
  const paymentEvent = await db.orderEvent.findFirst({
    where: { orderId, type: "payment_confirmed" },
    select: { id: true }
  });
  if (!paymentEvent) {
    await recordOrderEvent({
      orderId,
      type: "payment_confirmed",
      title: "Payment confirmed",
      detail: order.razorpayPaymentId ? `Razorpay ${order.razorpayPaymentId}` : "via outbox"
    });
  }
}
