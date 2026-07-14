"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionMsg } from "@/app/(portal)/portal/(session)/org-circle-actions";

export function OrgInviteForm({
  organizationId,
  action
}: {
  organizationId: string;
  action: (prev: ActionMsg, formData: FormData) => Promise<ActionMsg>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionMsg);

  return (
    <form action={formAction} className="max-w-md space-y-3 border border-border/70 p-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <p className="text-sm font-medium">Invite a seat</p>
      <div>
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" required placeholder="colleague@lab.edu" />
      </div>
      <div>
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="buyer"
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="buyer">Buyer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-emerald-700">
          Invite sent{state.acceptUrl ? " (check email; link also logged for SMTP-less environments)." : "."}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
