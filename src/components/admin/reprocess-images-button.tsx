"use client";

import { useState, useTransition } from "react";
import { Crop, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reprocessProductImagesAction } from "@/app/(admin)/admin/(console)/actions";

/**
 * Tightens existing product photos: crops wasted whitespace around the subject
 * (and restores legacy transparent cutouts onto white). Photos stay untouched
 * otherwise.
 */
export function ReprocessImagesButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function run() {
    startTransition(async () => {
      const result = await reprocessProductImagesAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Product photos tightened.");
      setDone(true);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending || done}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Crop className="size-4" />}
      {pending ? "Cropping photos…" : done ? "Photos tightened" : "Tighten product photos"}
    </Button>
  );
}
