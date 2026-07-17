import "server-only";
import { db } from "@/lib/db";
import { featureEnabled } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";

const DEFAULT_PLANS = [
  {
    slug: "research-circle-annual",
    name: "Research Circle — Annual",
    description: "Priority CoA access, institutional pricing alerts, and quarterly formulation briefs.",
    priceCents: 999900,
    intervalMonths: 12,
    benefits: "Priority support · CoA library · Quarterly briefs · Member pricing notices"
  },
  {
    slug: "research-circle-lab",
    name: "Research Circle — Lab Seat",
    description: "For small lab teams — same Circle benefits billed per researcher seat annually.",
    priceCents: 499900,
    intervalMonths: 12,
    benefits: "Lab seat · Shared document vault · Email alerts"
  }
] as const;

export async function ensureResearchCirclePlans() {
  for (const plan of DEFAULT_PLANS) {
    await db.researchCirclePlan.upsert({
      where: { slug: plan.slug },
      create: { ...plan },
      update: {
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        intervalMonths: plan.intervalMonths,
        benefits: plan.benefits,
        active: true
      }
    });
  }
}

export async function listActiveCirclePlans() {
  await ensureResearchCirclePlans();
  return db.researchCirclePlan.findMany({
    where: { active: true },
    orderBy: { priceCents: "asc" }
  });
}

export async function getActiveCircleSubscription(customerId: string) {
  return db.researchCircleSubscription.findFirst({
    where: {
      customerId,
      status: "active",
      currentPeriodEnd: { gt: new Date() }
    },
    include: { plan: true },
    orderBy: { currentPeriodEnd: "desc" }
  });
}

function addMonths(d: Date, months: number) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

export async function startCircleSubscription(input: {
  customerId: string;
  planId: string;
  /** When true (dev/test), activate without Razorpay. */
  skipPayment?: boolean;
}) {
  const plan = await db.researchCirclePlan.findFirst({
    where: { id: input.planId, active: true }
  });
  if (!plan) return { ok: false as const, error: "Plan not found." };

  const existing = await getActiveCircleSubscription(input.customerId);
  if (existing) {
    return { ok: false as const, error: "You already have an active Research Circle membership." };
  }

  const skip = featureEnabled("checkout_skip_payment");

  if (skip) {
    const now = new Date();
    const sub = await db.researchCircleSubscription.create({
      data: {
        customerId: input.customerId,
        planId: plan.id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: addMonths(now, plan.intervalMonths),
        razorpayPaymentId: `circle_skip_${Date.now()}`
      },
      include: { plan: true }
    });
    logger.info({ event: "circle_subscribed_skip", customerId: input.customerId, planId: plan.id }, "circle join (skip pay)");
    return { ok: true as const, skipPayment: true as const, subscription: sub };
  }

  logger.warn(
    { event: "circle_paid_join_disabled", customerId: input.customerId, planId: plan.id },
    "Research Circle paid enrollment requested before payment completion flow is wired"
  );
  return {
    ok: false as const,
    error: "Research Circle online enrollment is temporarily unavailable. Please contact support to join."
  };
}

/** Completes Circle membership after Razorpay verify (or admin grant). */
export async function activateCircleAfterPayment(input: {
  customerId: string;
  planId: string;
  razorpayPaymentId: string;
}) {
  const plan = await db.researchCirclePlan.findUnique({ where: { id: input.planId } });
  if (!plan) return { ok: false as const, error: "Plan not found." };

  const now = new Date();
  const sub = await db.researchCircleSubscription.create({
    data: {
      customerId: input.customerId,
      planId: plan.id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: addMonths(now, plan.intervalMonths),
      razorpayPaymentId: input.razorpayPaymentId
    },
    include: { plan: true }
  });
  return { ok: true as const, subscription: sub };
}

export async function cancelCircleSubscription(customerId: string) {
  const active = await getActiveCircleSubscription(customerId);
  if (!active) return { ok: false as const, error: "No active membership." };
  await db.researchCircleSubscription.update({
    where: { id: active.id },
    data: { status: "cancelled", cancelledAt: new Date() }
  });
  return { ok: true as const };
}
