"use client";

import { useTransition } from "react";
import { acceptOrgInviteAction } from "@/app/(portal)/portal/(session)/org-circle-actions";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await acceptOrgInviteAction(token);
        })
      }
    >
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  );
}
