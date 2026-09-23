import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id: productId } = await params;
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Título obrigatório." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  const last = await prisma.module.findFirst({
    where: { productId },
    orderBy: { position: "desc" },
  });

  const module = await prisma.module.create({
    data: {
      productId,
      title,
      position: (last?.position ?? 0) + 1,
    },
  });

  return NextResponse.json(module, { status: 201 });
}
