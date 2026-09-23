import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function getR2() {
  if (!r2Configured()) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadProductFile(file: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}) {
  const key = `products/${randomUUID()}-${file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const client = getR2();
  if (!client) {
    // Local fallback: store as data URL placeholder key
    return {
      key: `local://${key}`,
      sizeBytes: file.buffer.length,
      mimeType: file.mimeType,
      localFallback: true,
    };
  }
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimeType,
    }),
  );
  return { key, sizeBytes: file.buffer.length, mimeType: file.mimeType, localFallback: false };
}

export async function getSignedDownloadUrl(key: string, expiresIn = 120) {
  if (key.startsWith("local://")) {
    return { url: "#", local: true as const, localKey: key.slice("local://".length) };
  }
  const client = getR2();
  if (!client) return { url: "#", local: true as const };
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    { expiresIn },
  );
  return { url, local: false as const };
}

/** Resolve a local:// key to an absolute path inside the project (or null if unsafe/missing). */
export async function resolveLocalProductFile(key: string) {
  if (!key.startsWith("local://")) return null;
  const relative = key.slice("local://".length).replace(/^[/\\]+/, "");
  const root = process.cwd();
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) return null;
  try {
    await fs.access(absolute);
    return absolute;
  } catch {
    return null;
  }
}

export function getBunnyEmbedUrl(videoId: string) {
  const libraryId = process.env.BUNNY_LIBRARY_ID;
  if (!libraryId || !videoId) return null;
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false`;
}
