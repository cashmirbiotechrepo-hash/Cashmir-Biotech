"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionMsg } from "@/app/(portal)/portal/(session)/org-circle-actions";

export function CircleJoinForm({
  planId,
  action
}: {
  planId: string;
  action: (prev: ActionMsg, formData: FormData) => Promise<ActionMsg>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionMsg);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="planId" value={planId} />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">Welcome to Research Circle.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Join Research Circle"}
      </Button>
    </form>
  );
}
