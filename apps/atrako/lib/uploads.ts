/**
 * Arquivos enviados em runtime. `next start` só serve o que estava em `public/` no build,
 * e o container perde o disco a cada deploy: em produção `UPLOADS_DIR` aponta para um volume
 * e os arquivos saem por route handler.
 */

import path from "path";

export const UPLOAD_FILENAME = /^[A-Za-z0-9_-]{1,160}\.(png|jpe?g|webp|gif|pdf|txt|md|csv|docx|mp4|webm)$/;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function uploadsDir(bucket: string) {
  const root = process.env.UPLOADS_DIR?.trim();
  return root ? path.join(root, bucket) : path.join(process.cwd(), "public", bucket);
}

export function uploadContentType(filename: string) {
  return CONTENT_TYPES[filename.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

export async function saveUpload(bucket: string, filename: string, buffer: Buffer) {
  if (!UPLOAD_FILENAME.test(filename)) throw new Error("Nome de arquivo inválido");
  const { mkdir, writeFile } = await import("fs/promises");
  const dir = uploadsDir(bucket);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/${bucket}/${filename}`;
}

export async function readUpload(bucket: string, filename: string): Promise<Buffer | null> {
  if (!UPLOAD_FILENAME.test(filename)) return null;
  const { readFile } = await import("fs/promises");
  for (const dir of [uploadsDir(bucket), path.join(process.cwd(), "public", bucket)]) {
    try {
      return await readFile(path.join(dir, filename));
    } catch {
      // tenta o próximo diretório
    }
  }
  return null;
}
