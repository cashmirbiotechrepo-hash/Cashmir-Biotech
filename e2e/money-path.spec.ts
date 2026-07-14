import { test, expect } from "@playwright/test";

/**
 * Deep money path: fixture pending order → signed Razorpay webhook → invoice + packing PDF.
 * Requires E2E_HOOKS_ENABLED + RAZORPAY_WEBHOOK_SECRET on the webServer (see playwright.config).
 */
test.describe("checkout → webhook → invoice", () => {
  test("payment.captured marks paid and serves invoice PDF", async ({ request }) => {
    const fixtureRes = await request.post("/api/internal/e2e/fixture", {
      headers: { "x-e2e-secret": process.env.E2E_HOOKS_SECRET || "e2e-local-secret" }
    });
    expect(fixtureRes.ok(), await fixtureRes.text()).toBeTruthy();
    const fixture = await fixtureRes.json();
    expect(fixture.ok).toBeTruthy();
    expect(fixture.orderNumber).toBeTruthy();
    expect(fixture.confirmationToken).toBeTruthy();
    expect(fixture.webhook?.signature).toBeTruthy();

    const webhookRes = await request.post("/api/webhooks/razorpay", {
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": fixture.webhook.signature,
        "x-razorpay-event-id": fixture.webhook.eventId
      },
      data: fixture.webhook.body
    });
    expect(webhookRes.ok(), await webhookRes.text()).toBeTruthy();
    const webhookBody = await webhookRes.json();
    expect(webhookBody.ok).toBeTruthy();

    const invoiceRes = await request.get(
      `/api/order/${fixture.orderNumber}/invoice.pdf?t=${encodeURIComponent(fixture.confirmationToken)}`
    );
    expect(invoiceRes.ok(), await invoiceRes.text()).toBeTruthy();
    expect(invoiceRes.headers()["content-type"]).toContain("application/pdf");
    const invoiceBytes = await invoiceRes.body();
    expect(invoiceBytes.byteLength).toBeGreaterThan(500);

    const packingRes = await request.get(
      `/api/order/${fixture.orderNumber}/packing.pdf?t=${encodeURIComponent(fixture.confirmationToken)}`
    );
    expect(packingRes.ok(), await packingRes.text()).toBeTruthy();
    expect(packingRes.headers()["content-type"]).toContain("application/pdf");

    const confirmRes = await request.get(
      `/order/${fixture.orderNumber}?t=${encodeURIComponent(fixture.confirmationToken)}`
    );
    expect(confirmRes.ok()).toBeTruthy();
  });

  test("bad webhook signature is rejected", async ({ request }) => {
    const fixtureRes = await request.post("/api/internal/e2e/fixture", {
      headers: { "x-e2e-secret": process.env.E2E_HOOKS_SECRET || "e2e-local-secret" }
    });
    expect(fixtureRes.ok()).toBeTruthy();
    const fixture = await fixtureRes.json();

    const bad = await request.post("/api/webhooks/razorpay", {
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": "deadbeef",
        "x-razorpay-event-id": `evt_bad_${Date.now()}`
      },
      data: fixture.webhook.body
    });
    expect(bad.status()).toBe(400);
  });
});
