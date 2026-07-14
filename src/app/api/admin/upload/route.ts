import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import { adminErr, adminOk, requireAdminApi } from "@/lib/admin/api";
import { detectImageType } from "@/lib/admin/upload-validation";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
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
    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = detectImageType(bytes);
    if (!detected) {
      return adminErr("unsupported_type", "File content is not a supported image format.", 415);
    }

    const fileName = `${randomUUID()}.${detected}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), bytes);

    const url = `/uploads/${fileName}`;
    const altText = form.get("altText");

    await db.mediaAsset.create({
      data: {
        url,
        type: "image",
        altText: typeof altText === "string" ? altText.slice(0, 300) : "",
        uploadedBy: String(admin.email)
      }
    });

    return adminOk({ url });
  } catch (err) {
    logger.error({ err, event: "admin_upload_failed" }, "admin image upload failed");
    return adminErr("upload_failed", "Couldn't save the uploaded image. Please try again.", 500);
  }
}
