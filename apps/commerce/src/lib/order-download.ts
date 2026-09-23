import fs from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl, resolveLocalProductFile } from "@/lib/storage";

export type DownloadableFile = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
};

export async function getApprovedOrderFiles(orderId: string): Promise<DownloadableFile[] | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status !== "APPROVED") return null;

  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const files = await prisma.productFile.findMany({
    where: { productId: { in: productIds } },
    orderBy: { createdAt: "asc" },
  });

  return files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
  }));
}

export async function serveProductFileById(fileId: string) {
  const file = await prisma.productFile.findUnique({ where: { id: fileId } });
  if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  if (file.key.startsWith("local://")) {
    const absolute = await resolveLocalProductFile(file.key);
    if (!absolute) {
      return NextResponse.json({ error: "Arquivo local não encontrado" }, { status: 404 });
    }
    const buffer = await fs.readFile(absolute);
    const safeName = file.name.replace(/[^\w.\- ()\[\]]+/g, "_");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType || "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  }

  const signed = await getSignedDownloadUrl(file.key);
  if (signed.local) {
    return NextResponse.json(
      {
        error: "Arquivo local de demonstração — configure o R2 para downloads reais.",
        key: file.key,
      },
      { status: 501 },
    );
  }

  return NextResponse.redirect(signed.url);
}
