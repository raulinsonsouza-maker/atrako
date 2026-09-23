import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/symbius/auth";
import { getSymbiusAppUrl } from "@/lib/instagram/metaOAuth";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

const ALLOWED: Record<string, { ext: string; mediaType: "image" | "video" | "audio" }> =
  {
    "image/jpeg": { ext: "jpg", mediaType: "image" },
    "image/jpg": { ext: "jpg", mediaType: "image" },
    "image/png": { ext: "png", mediaType: "image" },
    "image/gif": { ext: "gif", mediaType: "image" },
    "image/webp": { ext: "webp", mediaType: "image" },
    "video/mp4": { ext: "mp4", mediaType: "video" },
    "video/quicktime": { ext: "mov", mediaType: "video" },
    "audio/mpeg": { ext: "mp3", mediaType: "audio" },
    "audio/mp4": { ext: "m4a", mediaType: "audio" },
  };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 400 });
  }

  const meta = ALLOWED[file.type];
  if (!meta) {
    return NextResponse.json(
      {
        error:
          "Formato não suportado. Use JPG, PNG, GIF, WebP, MP4, MOV, MP3 ou M4A.",
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande (máx. 25MB)" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${session.organizationId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${meta.ext}`;
  const dir = path.join(process.cwd(), "public", "inbox-media");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  const base = getSymbiusAppUrl();
  const url = `${base}/inbox-media/${filename}`;

  return NextResponse.json({
    url,
    mediaType: meta.mediaType,
    filename,
  });
}
