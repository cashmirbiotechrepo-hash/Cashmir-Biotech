import "server-only";
import baked from "@/generated/amplify-runtime-env.json";

/**
 * Amplify Hosting SSR compute often starts with an empty process.env for app
 * secrets even when they are set in the Amplify Console / build environment.
 * Hydrate missing keys from the JSON snapshot written during `amplify.yml`
 * (`scripts/write-amplify-runtime-env.cjs`) and bundled into the server build.
 *
 * Runtime env always wins: we never overwrite a non-empty process.env value.
 */
export function applyBakedAmplifyEnv(): void {
  const entries =
    baked && typeof baked === "object"
      ? Object.entries(baked as Record<string, string>)
      : [];
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
