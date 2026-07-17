import "server-only";

/**
 * Legacy compatibility hook.
 *
 * Secrets must come from the deployment runtime environment. Do not import or
 * bundle generated JSON snapshots of production secrets into the SSR build.
 */
export function applyBakedAmplifyEnv(): void {
  return;
}
