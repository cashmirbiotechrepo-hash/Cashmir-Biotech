"use client";

import { useRef, useState } from "react";
import {
  deactivateCertificateAction,
  saveCertificateAction
} from "@/app/(admin)/admin/(console)/coa-actions";
import { FormStatus, SaveButton, useAdminForm } from "@/components/admin/admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CoaRow = {
  id: string;
  lotCode: string;
  title: string;
  fileUrl: string;
  issuedAt: string;
  active: boolean;
};

export function CoaManager({
  productId,
  certificates
}: {
  productId: string;
  certificates: CoaRow[];
}) {
  const { pending, state, onSubmit } = useAdminForm(saveCertificateAction, { refresh: true });
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "document");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed");
      setFileUrl(json.data.url as string);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-light">Certificates of Analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload lot CoA PDFs for Customer Portal downloads after purchase.
        </p>
      </div>

      <ul className="divide-y rounded-lg border">
        {certificates.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">No CoA files yet.</li>
        ) : (
          certificates.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {c.title} · Lot {c.lotCode}
                  {!c.active ? <span className="ml-2 text-muted-foreground">(inactive)</span> : null}
                </p>
                <a href={c.fileUrl} className="text-xs text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                  {c.fileUrl}
                </a>
              </div>
              {c.active ? (
                <form
                  action={async (fd) => {
                    await deactivateCertificateAction(fd);
                  }}
                >
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="productId" value={productId} />
                  <Button type="submit" variant="ghost" size="sm">
                    Deactivate
                  </Button>
                </form>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="grid max-w-xl gap-3 rounded-lg border p-4">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="fileUrl" value={fileUrl} />
        <div>
          <Label htmlFor="coa-title">Title</Label>
          <Input id="coa-title" name="title" placeholder="Certificate of Analysis" defaultValue="Certificate of Analysis" required />
        </div>
        <div>
          <Label htmlFor="coa-lot">Lot code</Label>
          <Input id="coa-lot" name="lotCode" placeholder="CB2026-001" required />
        </div>
        <div>
          <Label htmlFor="coa-file">PDF file</Label>
          <Input
            id="coa-file"
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {uploading ? <p className="mt-1 text-xs text-muted-foreground">Uploading…</p> : null}
          {fileUrl ? <p className="mt-1 truncate text-xs text-muted-foreground">{fileUrl}</p> : null}
          {uploadError ? <p className="mt-1 text-xs text-destructive">{uploadError}</p> : null}
        </div>
        <FormStatus state={state} />
        <SaveButton pending={pending || uploading} disabled={!fileUrl} label="Publish CoA" />
      </form>
    </div>
  );
}
