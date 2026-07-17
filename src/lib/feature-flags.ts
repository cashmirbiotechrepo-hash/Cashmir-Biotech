/** Small env-based feature flags (no third-party flag service yet). */
export function featureEnabled(name: "admin_pow"): boolean {
  switch (name) {
    case "admin_pow":
      return Boolean(process.env.POW_SECRET) || process.env.NODE_ENV === "production";
    default:
      return false;
  }
}
