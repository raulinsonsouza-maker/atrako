import { NextRequest, NextResponse } from "next/server";

function isAdminAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

async function uploadToBlob(buffer: Buffer, filename: string): Promise<string> {
  const { put } = await import("@vercel/blob");
  const blob = await put(`logos/${filename}`, buffer, { access: "public" });
  return blob.url;
}

async function deleteFromBlob(url: string): Promise<void> {
  const { del } = await import("@vercel/blob");
  await del(url);
}

async function uploadToFilesystem(buffer: Buffer, filename: string): Promise<string> {
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const dir = path.join(process.cwd(), "public", "logos");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/logos/${filename}`;
}

async function deleteFromFilesystem(url: string): Promise<void> {
  const { unlink } = await import("fs/promises");
  const path = await import("path");
  const filename = path.basename(url);
  const filePath = path.join(process.cwd(), "public", "logos", filename);
  try {
    await unlink(filePath);
  } catch {
    // ignore if file doesn't exist
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 400 });

  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Formato não suportado. Use PNG, JPG, WebP, SVG ou GIF." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filename = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

  try {
    const url = USE_BLOB
      ? await uploadToBlob(buffer, filename)
      : await uploadToFilesystem(buffer, filename);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Falha no upload. Tente novamente." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL inválida" }, { status: 400 });

  try {
    if (url.startsWith("https://")) {
      await deleteFromBlob(url);
    } else if (url.startsWith("/logos/")) {
      await deleteFromFilesystem(url);
    }
  } catch {
    // ignore delete errors
  }

  return NextResponse.json({ ok: true });
}
