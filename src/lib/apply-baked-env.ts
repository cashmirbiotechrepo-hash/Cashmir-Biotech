import "server-only";
import baked from "@/generated/amplify-runtime-env.json";

/**
 * Amplify Hosting SSR sometimes starts with empty process.env for app secrets
 * even when they appear in the Amplify Console. Hydrate from the build-time JSON.
 */
export function applyBakedAmplifyEnv(): void {
  const entries = baked && typeof baked === "object" ? Object.entries(baked as Record<string, string>) : [];
  let applied = 0;
  for (const [key, value] of entries) {
    if (!value) continue;
    if (!process.env[key] || process.env[key] === "") {
      process.env[key] = value;
      applied += 1;
    }
  }
  if (applied > 0) {
    console.info(`[env] Applied ${applied} baked Amplify runtime env key(s)`);
  }
}
