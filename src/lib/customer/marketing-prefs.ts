import "server-only";

import { db } from "@/lib/db";

/**
 * Marketing campaign recipients:
 * - Homepage / journal subscribers who are not opted out on a Customer account
 * - Customers with notifyMarketing=true
 */
export async function listMarketingRecipientEmails(): Promise<string[]> {
  const [subscribers, optedIn, optedOut] = await Promise.all([
    db.subscriber.findMany({
      where: { status: "subscribed" },
      select: { email: true }
    }),
    db.customer.findMany({
      where: { notifyMarketing: true, active: true },
      select: { email: true }
    }),
    db.customer.findMany({
      where: { notifyMarketing: false },
      select: { email: true }
    })
  ]);

  const blocked = new Set(optedOut.map((c) => c.email.toLowerCase().trim()));
  const emails = new Set<string>();

  for (const s of subscribers) {
    const email = s.email.toLowerCase().trim();
    if (email && !blocked.has(email)) emails.add(email);
  }
  for (const c of optedIn) {
    const email = c.email.toLowerCase().trim();
    if (email) emails.add(email);
  }

  return [...emails];
}

/** Keep Subscriber row in sync with portal marketing preference. */
export async function syncMarketingSubscriber(
  emailRaw: string,
  notifyMarketing: boolean
): Promise<void> {
  const email = emailRaw.toLowerCase().trim();
  if (!email) return;

  if (notifyMarketing) {
    await db.subscriber.upsert({
      where: { email },
      create: { email, source: "portal_prefs", status: "subscribed" },
      update: { status: "subscribed", unsubscribedAt: null }
    });
    return;
  }

  await db.subscriber.updateMany({
    where: { email },
    data: { status: "unsubscribed", unsubscribedAt: new Date() }
  });
}
