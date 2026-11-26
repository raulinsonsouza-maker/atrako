import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { UPLOAD_FILENAME, uploadContentType, uploadsDir } from "@/lib/uploads";

export const runtime = "nodejs";

async function resolveFile(file: string): Promise<{ abs: string; size: number } | null> {
  if (!UPLOAD_FILENAME.test(file)) return null;
  for (const dir of [uploadsDir("lp-media"), path.join(process.cwd(), "public", "lp-media")]) {
    const abs = path.join(dir, file);
    try {
      const st = await stat(abs);
      if (st.isFile()) return { abs, size: st.size };
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m) return null;
  const start = m[1] ? Number(m[1]) : NaN;
  const endRaw = m[2] ? Number(m[2]) : NaN;
  if (Number.isFinite(start) && Number.isFinite(endRaw)) {
    if (start > endRaw || start >= size) return null;
    return { start, end: Math.min(endRaw, size - 1) };
  }
  if (Number.isFinite(start)) {
    if (start >= size) return null;
    return { start, end: size - 1 };
  }
  if (Number.isFinite(endRaw)) {
    const length = Math.min(endRaw, size);
    return { start: size - length, end: size - 1 };
  }
  return null;
}

function fileStream(abs: string, start?: number, end?: number): ReadableStream {
  const node =
    start != null && end != null
      ? createReadStream(abs, { start, end })
      : createReadStream(abs);
  return Readable.toWeb(node) as ReadableStream;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const resolved = await resolveFile(file);
  if (!resolved) return new NextResponse("Not found", { status: 404 });

  const { abs, size } = resolved;
  const contentType = uploadContentType(file);
  const range = parseRange(request.headers.get("range"), size);

  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  if (range) {
    const { start, end } = range;
    return new NextResponse(fileStream(abs, start, end), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  return new NextResponse(fileStream(abs), {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(size),
    },
  });
}
