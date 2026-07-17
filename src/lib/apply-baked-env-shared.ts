import baked from "@/generated/amplify-runtime-env.json";

/**
 * Edge + Node compatible hydrate from the Amplify build-time JSON snapshot.
 * No `server-only` — middleware must be able to call this.
 *
 * Runtime env always wins: never overwrite a non-empty process.env value.
 */
export function applyBakedAmplifyEnv(): void {
  const entries =
    baked && typeof baked === "object"
      ? Object.entries(baked as Record<string, string>)
      : [];
  for (const [key, value] of entries) {
    if (!value) continue;
    if (!process.env[key] || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}
