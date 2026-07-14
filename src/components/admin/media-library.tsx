"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MediaAsset } from "@prisma/client";
import { Loader2, Upload } from "lucide-react";
import { deleteMediaAssetAction, updateMediaAssetAction } from "@/app/(admin)/admin/(console)/media-actions";
import { AdminField, DeleteButton, FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

function MediaCard({ asset }: { asset: MediaAsset }) {
  const { pending, state, onSubmit } = useAdminForm(updateMediaAssetAction);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        <Image src={asset.url} alt={asset.altText || "Media asset"} fill className="object-cover" sizes="300px" />
      </div>
      <CardContent className="space-y-3 p-4">
        <p className="truncate font-mono text-xs text-muted-foreground">{asset.url}</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="id" value={asset.id} />
          <AdminField label="Alt text" name="altText" defaultValue={asset.altText} required={false} />
          <div className="flex flex-wrap items-center gap-2">
            <SaveButton pending={pending} label="Save" />
            <DeleteButton action={deleteMediaAssetAction} id={asset.id} label="Delete" />
            <FormStatus state={state} />
          </div>
        </form>
        <p className="text-[10px] text-muted-foreground">
          Uploaded {new Date(asset.createdAt).toLocaleDateString("en-IN")}
          {asset.uploadedBy ? ` · ${asset.uploadedBy}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

export function MediaLibrary({ assets }: { assets: MediaAsset[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Upload failed.");
        return;
      }
      toast.success("Image uploaded.");
      router.refresh();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(file);
            e.target.value = "";
          }}
        />
        <Button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Uploading…" : "Upload image"}
        </Button>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          title="No media yet"
          description="Upload images for products, blog posts, and patents. Files are stored in /public/uploads."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <MediaCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
