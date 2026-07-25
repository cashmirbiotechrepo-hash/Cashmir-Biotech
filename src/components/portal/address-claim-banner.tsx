"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  confirmAddressClaimAction,
  dismissAddressClaimAction
} from "@/app/(portal)/portal/(session)/actions";

export function AddressClaimBanner({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (count <= 0) return null;

  return (
    <section
      className="border border-gold/30 bg-gold/10 px-4 py-4"
      role="region"
      aria-label="Save addresses from past orders"
    >
      <p className="text-[14px] font-medium text-ink">
        We found {count} address{count === 1 ? "" : "es"} from previous orders.
      </p>
      <p className="mt-1 text-[13px] text-ink-mute">
        Add {count === 1 ? "it" : "them"} to your address book for faster checkout?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await confirmAddressClaimAction();
              toast.success(
                count === 1 ? "Address added to your book." : "Addresses added to your book."
              );
              router.refresh();
            });
          }}
          className="inline-flex min-h-10 items-center justify-center bg-ink px-4 text-[13px] font-medium text-paper disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await dismissAddressClaimAction();
              toast.message("Got it — we won’t ask again.");
              router.refresh();
            });
          }}
          className="inline-flex min-h-10 items-center justify-center border border-ink/15 px-4 text-[13px] font-medium text-ink disabled:opacity-60"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
