import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

async function uploadToBlob(
  buffer: Buffer,
  pathname: string,
  contentType: string,
) {
  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType,
  });
  return blob.url;
}

async function uploadToFilesystem(buffer: Buffer, filename: string) {
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const dir = path.join(process.cwd(), "public", "lp-media");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/lp-media/${filename}`;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Formulário inválido" }, { status: 400 });
  }

  const workspaceId =
    String(formData.get("workspaceId") || "").trim() ||
    request.nextUrl.searchParams.get("workspaceId")?.trim() ||
    "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Use PNG, JPG, WebP ou GIF." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Imagem até 5 MB." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "jpg";
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const pathname = `lp/${workspaceId}/${filename}`;

  try {
    const url = USE_BLOB
      ? await uploadToBlob(bytes, pathname, file.type)
      : await uploadToFilesystem(bytes, `${workspaceId}_${filename}`);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[lp upload]", err);
    return NextResponse.json(
      { error: "Falha no upload. Tente novamente." },
      { status: 500 },
    );
  }
}
