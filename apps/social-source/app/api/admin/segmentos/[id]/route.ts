import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isAdminAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { nome, cor } = await req.json();
  try {
    const segmento = await prisma.segmento.update({
      where: { id },
      data: {
        ...(nome?.trim() ? { nome: nome.trim() } : {}),
        ...(cor ? { cor } : {}),
      },
    });
    return NextResponse.json(segmento);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar segmento" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.segmento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
