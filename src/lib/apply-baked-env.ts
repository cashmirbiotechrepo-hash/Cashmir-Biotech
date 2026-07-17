import "server-only";
import { applyBakedAmplifyEnv as applyShared } from "@/lib/apply-baked-env-shared";

/**
 * Node/SSR entry — re-exports the shared hydrate so existing imports keep working.
 * Amplify Hosting SSR often starts with empty process.env; bake fills gaps.
 */
export function applyBakedAmplifyEnv(): void {
  applyShared();
}
