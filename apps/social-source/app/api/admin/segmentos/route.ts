import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isAdminAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET() {
  const segmentos = await prisma.segmento.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(segmentos);
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { nome, cor } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  try {
    const segmento = await prisma.segmento.create({
      data: { nome: nome.trim(), cor: cor || "#6b7280" },
    });
    return NextResponse.json(segmento, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Segmento já existe com esse nome" }, { status: 409 });
  }
}
