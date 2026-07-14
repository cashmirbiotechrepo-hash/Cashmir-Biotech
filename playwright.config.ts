import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          ...process.env,
          E2E_HOOKS_ENABLED: "true",
          E2E_HOOKS_SECRET: process.env.E2E_HOOKS_SECRET || "e2e-local-secret",
          RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "e2e_webhook_secret",
          CHECKOUT_SKIP_PAYMENT: process.env.CHECKOUT_SKIP_PAYMENT || "true",
          NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT: process.env.NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT || "true"
        }
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
