/** Small env-based feature flags (no third-party flag service yet). */
export function featureEnabled(name: "checkout_skip_payment" | "admin_pow"): boolean {
  switch (name) {
    case "checkout_skip_payment": {
      // Hard fail-closed: never skip payment in production, regardless of env footguns.
      if (process.env.NODE_ENV === "production") return false;
      if (process.env.VERCEL_ENV === "production") return false;
      return process.env.CHECKOUT_SKIP_PAYMENT === "true" || process.env.CHECKOUT_SKIP_PAYMENT === "1";
    }
    case "admin_pow":
      return Boolean(process.env.POW_SECRET) || process.env.NODE_ENV === "production";
    default:
      return false;
  }
}
