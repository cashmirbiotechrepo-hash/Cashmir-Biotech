"use client";

import { useState, useTransition } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reprocessProductImagesAction } from "@/app/(admin)/admin/(console)/actions";

/** Converts existing product photos to transparent cutouts for the storefront. */
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
      toast.success(result.message ?? "Product images reprocessed.");
      setDone(true);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending || done}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
      {pending ? "Processing photos…" : done ? "Photos converted" : "Convert photos for storefront"}
    </Button>
  );
}
