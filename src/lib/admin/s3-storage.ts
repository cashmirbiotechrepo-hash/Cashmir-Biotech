import type { S3Client } from "@aws-sdk/client-s3";
import { logger } from "@/lib/logger";

/**
 * Central S3 storage helper for admin uploads. Keeps put/delete + URL parsing
 * in one place so upload and deletion paths can never drift apart again.
 */

export interface S3UploadConfig {
  bucket: string;
  region: string;
  /** CDN/base URL serving the bucket (e.g. CloudFront), without trailing slash. */
  publicBase?: string;
}

export function getS3UploadConfig(): S3UploadConfig | null {
  const bucket = process.env.S3_UPLOAD_BUCKET?.trim();
  if (!bucket) return null;
  const region = (
    process.env.S3_UPLOAD_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    ""
  ).trim();
  if (!region) {
    throw new Error("S3_UPLOAD_REGION (or AWS_REGION) is required when S3_UPLOAD_BUCKET is set.");
  }
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  return { bucket, region, publicBase: publicBase || undefined };
}

let cachedClient: S3Client | null = null;
let cachedClientRegion: string | null = null;

async function getClient(region: string): Promise<S3Client> {
  if (cachedClient && cachedClientRegion === region) return cachedClient;
  const { S3Client: Client } = await import("@aws-sdk/client-s3");
  // Amplify reserves the AWS_ env prefix, so explicit keys use app-specific
  // names. Without them the SDK default chain (execution role) applies.
  const accessKeyId = process.env.S3_UPLOAD_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_UPLOAD_SECRET_ACCESS_KEY?.trim();
  cachedClient = new Client({
    region,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {})
  });
  cachedClientRegion = region;
  return cachedClient;
}

export function s3PublicUrl(config: S3UploadConfig, key: string): string {
  return config.publicBase
    ? `${config.publicBase}/${key}`
    : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

/** Derive the object key from a stored asset URL. Returns null for non-S3 URLs. */
export function s3KeyFromUrl(config: S3UploadConfig, url: string): string | null {
  if (config.publicBase && url.startsWith(`${config.publicBase}/`)) {
    return url.slice(config.publicBase.length + 1).split("?")[0] || null;
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === `${config.bucket}.s3.${config.region}.amazonaws.com` ||
      parsed.hostname === `${config.bucket}.s3.amazonaws.com`
    ) {
      const key = parsed.pathname.replace(/^\/+/, "");
      return key || null;
    }
  } catch {
    // relative/local URL — not an S3 object
  }
  return null;
}

export async function putS3Object(
  config: S3UploadConfig,
  key: string,
  body: Buffer,
  contentType: string,
  contentDisposition?: string
): Promise<string> {
  const client = await getClient(config.region);
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
      CacheControl: "public, max-age=31536000, immutable"
    })
  );
  return s3PublicUrl(config, key);
}

export async function deleteS3Object(config: S3UploadConfig, key: string): Promise<void> {
  const client = await getClient(config.region);
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

/**
 * Best-effort delete of the S3 object backing an asset URL.
 * Never throws — DB cleanup must not be blocked by storage hiccups.
 */
export async function deleteS3ObjectByUrl(url: string): Promise<void> {
  let config: S3UploadConfig | null = null;
  try {
    config = getS3UploadConfig();
  } catch (err) {
    logger.error({ err, url, event: "s3_delete_misconfigured" }, "S3 delete skipped — bad config");
    return;
  }
  if (!config) return;
  const key = s3KeyFromUrl(config, url);
  if (!key) return;
  try {
    await deleteS3Object(config, key);
  } catch (err) {
    logger.error({ err, url, key, event: "s3_delete_failed" }, "failed to delete S3 object");
  }
}
