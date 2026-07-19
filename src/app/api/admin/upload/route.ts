import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import { adminErr, adminOk, requireAdminApi } from "@/lib/admin/api";
import { CROP_SUFFIX, autoCropWhitespace } from "@/lib/admin/product-crop";
import { deleteS3Object, getS3UploadConfig, putS3Object } from "@/lib/admin/s3-storage";
import { detectImageType, detectPdf } from "@/lib/admin/upload-validation";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { clientIpFromRequest, getAdminUploadRatelimit } from "@/lib/rate-limit-edge";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  // Rate check
  const ip = clientIpFromRequest(req);
  const limiter = getAdminUploadRatelimit();
  const { success } = await limiter.limit(ip);
  if (!success) {
    return adminErr("rate_limited", "Too many upload attempts. Please slow down.", 429);
  }

  const { admin, error } = await requireAdminApi();
  if (error) return error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return adminErr("bad_request", "Expected a multipart form upload.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return adminErr("no_file", "No file was provided.", 400);
  }

  if (file.size > MAX_BYTES) {
    return adminErr("too_large", "Image must be 8 MB or smaller.", 413);
  }

  try {
    let bytes: Buffer = Buffer.from(await file.arrayBuffer());
    const purpose = String(form.get("purpose") ?? "");
    const allowPdf = purpose === "document";
    const detectedImage = detectImageType(bytes);
    const isPdf = allowPdf && detectPdf(bytes);

    if (!detectedImage && !isPdf) {
      return adminErr(
        "unsupported_type",
        allowPdf
          ? "File must be a supported image or PDF."
          : "File content is not a supported image format.",
        415
      );
    }

    let ext = isPdf ? "pdf" : detectedImage!;
    let cropped = false;

    // Product photos: crop away wasted empty canvas around the subject so it
    // fills the frame. The photograph itself (lighting, shadows, backdrop) is
    // preserved — geometry only. Skipped when the shot is already tight.
    if (!isPdf && purpose === "product" && ext !== "gif") {
      const processed = await autoCropWhitespace(bytes).catch(() => null);
      if (processed) {
        bytes = processed.buffer;
        ext = processed.extension;
        cropped = true;
      }
    }

    const fileName = cropped ? `${randomUUID()}${CROP_SUFFIX}.${ext}` : `${randomUUID()}.${ext}`;
    let url: string;
    const contentType = isPdf
      ? "application/pdf"
      : ext === "jpg"
        ? "image/jpeg"
        : ext === "png"
          ? "image/png"
          : ext === "gif"
            ? "image/gif"
            : ext === "webp"
              ? "image/webp"
              : ext === "avif"
                ? "image/avif"
                : `image/${ext}`;

    // Serverless filesystems are ephemeral — files must go to cloud object storage.
    // Preferred: AWS S3 (S3_UPLOAD_BUCKET). Legacy: Vercel Blob (BLOB_READ_WRITE_TOKEN).
    const s3Config = getS3UploadConfig();
    let s3Key: string | null = null;
    if (s3Config) {
      s3Key = `uploads/${fileName}`;
      url = await putS3Object(
        s3Config,
        s3Key,
        bytes,
        contentType,
        isPdf ? "inline" : undefined
      );
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`uploads/${fileName}`, bytes, {
        access: "public",
        contentType
      });
      url = blob.url;
    } else if (process.env.NODE_ENV === "production") {
      throw new Error(
        "S3_UPLOAD_BUCKET (or BLOB_READ_WRITE_TOKEN) is required in production for cloud file uploads."
      );
    } else {
      // Local dev fallback
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), bytes);
      url = `/uploads/${fileName}`;
    }

    const altText = form.get("altText");

    try {
      await db.mediaAsset.create({
        data: {
          url,
          type: isPdf ? "document" : "image",
          altText: typeof altText === "string" ? altText.slice(0, 300) : "",
          uploadedBy: String(admin.email)
        }
      });
    } catch (dbErr) {
      // Compensating delete — don't strand an untracked object in S3.
      if (s3Config && s3Key) {
        await deleteS3Object(s3Config, s3Key).catch((cleanupErr) =>
          logger.error(
            { err: cleanupErr, key: s3Key, event: "s3_rollback_failed" },
            "failed to roll back orphaned S3 object after DB error"
          )
        );
      }
      throw dbErr;
    }

    return adminOk({ url });
  } catch (err) {
    logger.error(
      {
        err,
        errName: err instanceof Error ? err.name : undefined,
        errMessage: err instanceof Error ? err.message : String(err),
        event: "admin_upload_failed"
      },
      "admin image upload failed"
    );
    return adminErr("upload_failed", "Couldn't save the uploaded image. Please try again.", 500);
  }
}
