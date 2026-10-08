import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveAssistantSession } from "@/lib/atrako-agent/session";
import { excerptFromFile } from "@/lib/atrako-agent/attachment-text";
import {
  ATTACHMENT_LIMITS,
  attachmentTooBig,
  kindFromFile,
  type AttachmentKind,
} from "@/lib/atrako-agent/attachments";
import { saveUpload, uploadContentType } from "@/lib/uploads";

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const BY_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "pdf", "txt", "md", "csv", "docx", "mp4", "webm"]);

function fileExt(file: File): string | null {
  const fromType = EXT[file.type];
  if (fromType) return fromType;
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!BY_EXT.has(fromName)) return null;
  return fromName === "jpeg" ? "jpg" : fromName;
}

export async function POST(request: NextRequest) {
  const s = await resolveAssistantSession();
  if (!s.ok) return s.response;
  const { workspaceId } = s.session;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 400 });
  }

  const ext = fileExt(file);
  const kind = ext ? kindFromFile(file.type, `arquivo.${ext}`) : null;
  if (!ext || !kind) {
    return NextResponse.json(
      { error: "Use imagem (png, jpg, webp, gif), documento (pdf, txt, md, csv, docx) ou vídeo (mp4, webm)." },
      { status: 400 },
    );
  }
  if (attachmentTooBig(kind, file.size)) {
    const limit = kind === "image" ? "5 MB" : kind === "document" ? "8 MB" : "25 MB";
    return NextResponse.json({ error: `Esse arquivo passa de ${limit}.` }, { status: 400 });
  }
  if (file.size > ATTACHMENT_LIMITS.video) {
    return NextResponse.json({ error: "Arquivo grande demais." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const mime = uploadContentType(filename).split(";")[0];
  const pathname = `lp/${workspaceId}/${filename}`;

  try {
    const url = USE_BLOB
      ? await uploadToBlob(bytes, pathname, mime)
      : await saveUpload("lp-media", `${workspaceId}_${filename}`, bytes);
    const text = kind === "document" ? await excerptFromFile(bytes, mime, file.name || `arquivo.${ext}`) : "";
    return NextResponse.json({
      id: randomUUID(),
      name: (file.name || `arquivo.${ext}`).slice(0, 120),
      kind: kind satisfies AttachmentKind,
      mime,
      url,
      ...(text ? { text } : {}),
    });
  } catch (err) {
    console.error("[atrako-attachment]", err);
    return NextResponse.json({ error: "Falha no upload. Tente novamente." }, { status: 500 });
  }
}

async function uploadToBlob(buffer: Buffer, pathname: string, contentType: string) {
  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, buffer, { access: "public", contentType });
  return blob.url;
}
