import { test, expect } from "@playwright/test";

test.describe("public smoke", () => {
  test("home responds", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("health endpoint", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
  });

  test("order lookup page", async ({ page }) => {
    const res = await page.goto("/order/lookup");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /find your order/i })).toBeVisible();
  });
});
