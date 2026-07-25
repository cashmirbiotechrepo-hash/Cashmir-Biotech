"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Fire Sonner toasts when a portal useActionState result flips. */
export function usePortalActionToast(
  state: { ok?: true; error?: string },
  messages: { success: string }
) {
  const seen = useRef<typeof state | null>(null);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(messages.success);
  }, [state, messages.success]);
}
