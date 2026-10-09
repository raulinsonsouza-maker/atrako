import { NextResponse } from "next/server";
import { readUpload, uploadContentType } from "@/lib/uploads";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const data = await readUpload("food-media", file);
  if (!data) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": uploadContentType(file), "Cache-Control": "public, max-age=86400" },
  });
}
