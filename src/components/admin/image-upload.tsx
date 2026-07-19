"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, ImageIcon, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ASPECTS: { label: string; value: number | null }[] = [
  { label: "Original", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 }
];

const FRAME_MAX = 320;

async function uploadBlob(data: Blob, filename: string, purpose?: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", data, filename);
  if (purpose) fd.append("purpose", purpose);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Upload failed. Please try again.");
  }
  return json.data.url as string;
}

function frameDimensions(aspect: number) {
  if (aspect >= 1) return { w: FRAME_MAX, h: Math.round(FRAME_MAX / aspect) };
  return { w: Math.round(FRAME_MAX * aspect), h: FRAME_MAX };
}

type CropperProps = {
  file: File;
  defaultAspect: number | null;
  onCancel: () => void;
  onConfirm: (data: Blob, filename: string) => void;
};

function ImageCropper({ file, defaultAspect, onCancel, onConfirm }: CropperProps) {
  const [src, setSrc] = useState<string>("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number | null>(defaultAspect);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const el = new window.Image();
    el.onload = () => setImg(el);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const frame = aspect ? frameDimensions(aspect) : null;

  const geometry = useCallback(() => {
    if (!img || !frame) return null;
    const base = Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight);
    const scale = base * zoom;
    return { scale, dispW: img.naturalWidth * scale, dispH: img.naturalHeight * scale };
  }, [img, frame, zoom]);

  const clamp = useCallback(
    (x: number, y: number) => {
      const g = geometry();
      if (!g || !frame) return { x, y };
      const minX = frame.w - g.dispW;
      const minY = frame.h - g.dispH;
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y))
      };
    },
    [geometry, frame]
  );

  // Re-center whenever aspect or image changes.
  useEffect(() => {
    const g = geometry();
    if (!g || !frame) return;
    setOffset({ x: (frame.w - g.dispW) / 2, y: (frame.h - g.dispH) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, img]);

  function onZoom(next: number) {
    const g = geometry();
    if (!g || !frame) {
      setZoom(next);
      return;
    }
    const cx = frame.w / 2 - offset.x;
    const cy = frame.h / 2 - offset.y;
    const ratio = next / zoom;
    setZoom(next);
    setOffset(clamp(frame.w / 2 - cx * ratio, frame.h / 2 - cy * ratio));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOffset(clamp(nx, ny));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function applyCrop() {
    const g = geometry();
    if (!img || !frame || !g) return;
    const sx = -offset.x / g.scale;
    const sy = -offset.y / g.scale;
    const sw = frame.w / g.scale;
    const sh = frame.h / g.scale;
    const outW = Math.round(Math.min(1600, sw));
    const outH = Math.round((outW * frame.h) / frame.w);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob, "cropped.png");
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h3 className="text-base font-semibold text-foreground">Adjust image</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an aspect ratio and drag to reposition, or keep the original.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => setAspect(a.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                aspect === a.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          {frame ? (
            <div
              className="relative touch-none overflow-hidden rounded-lg border border-border bg-muted"
              style={{ width: frame.w, height: frame.h, cursor: "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: offset.x,
                    top: offset.y,
                    width: (geometry()?.dispW ?? 0) || undefined,
                    height: (geometry()?.dispH ?? 0) || undefined,
                    maxWidth: "none"
                  }}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex max-h-[320px] items-center justify-center rounded-lg border border-border bg-muted p-2">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="Original preview" className="max-h-[300px] w-auto rounded object-contain" />
              ) : null}
            </div>
          )}
        </div>

        {frame ? (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer accent-primary"
            />
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {frame ? (
            <Button type="button" onClick={applyCrop}>
              Apply crop
            </Button>
          ) : (
            <Button type="button" onClick={() => onConfirm(file, file.name)}>
              Use original
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImageUploadField({
  name,
  label,
  defaultValue = "",
  aspect = null,
  helpText,
  required = false,
  purpose
}: {
  name: string;
  label: string;
  defaultValue?: string;
  aspect?: number | null;
  helpText?: string;
  required?: boolean;
  /** "product" enables automatic white-background removal server-side. */
  purpose?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleConfirm(data: Blob, filename: string) {
    setPending(null);
    setBusy(true);
    setErr(null);
    try {
      const uploaded = await uploadBlob(data, filename, purpose);
      setUrl(uploaded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="size-3" />
          {showUrl ? "Hide URL" : "Paste URL"}
        </button>
      </div>

      <input type="hidden" name={name} value={url} required={required} />

      <div className="flex items-start gap-4">
        <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : url ? (
                <Crop className="size-4" />
              ) : (
                <Upload className="size-4" />
              )}
              {busy ? "Uploading…" : url ? "Replace / crop" : "Upload image"}
            </Button>
            {url ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUrl("")}
                disabled={busy}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {helpText ?? "PNG, JPG, WEBP up to 8 MB. Crop before upload if needed."}
          </p>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
        </div>
      </div>

      {showUrl ? (
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="/uploads/example.png or https://…"
        />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            setErr(null);
            setPending(file);
          }
        }}
      />

      {pending ? (
        <ImageCropper
          file={pending}
          defaultAspect={aspect}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </div>
  );
}

export function GalleryUploadField({
  name,
  label,
  defaultValue = [],
  aspect = 1,
  helpText,
  max = 8,
  purpose
}: {
  name: string;
  label: string;
  defaultValue?: string[];
  aspect?: number | null;
  helpText?: string;
  max?: number;
  /** "product" enables automatic white-background removal server-side. */
  purpose?: string;
}) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleConfirm(data: Blob, filename: string) {
    setPending(null);
    setBusy(true);
    setErr(null);
    try {
      const uploaded = await uploadBlob(data, filename, purpose);
      setUrls((prev) => [...prev, uploaded].slice(0, max));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function remove(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setUrls((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {urls.map((u, i) => (
            <div key={`${u}-${i}`} className="group relative size-24 overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-contain" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-[11px] text-white disabled:opacity-30"
                  aria-label="Move left"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-[11px] text-white"
                  aria-label="Remove"
                >
                  <Trash2 className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === urls.length - 1}
                  className="text-[11px] text-white disabled:opacity-30"
                  aria-label="Move right"
                >
                  ▶
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || urls.length >= max}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Uploading…" : "Add image"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {urls.length}/{max} · {helpText ?? "Extra product photos shown in the gallery."}
        </span>
      </div>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            setErr(null);
            setPending(file);
          }
        }}
      />

      {pending ? (
        <ImageCropper
          file={pending}
          defaultAspect={aspect}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </div>
  );
}
