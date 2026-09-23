import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const c = await prisma.conexaoIntegracao.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  return NextResponse.json({
    id: c.id,
    nome: c.nome,
    plataforma: c.plataforma,
    ativo: c.ativo,
    hasMetaAccessToken: !!c.metaAccessToken,
    hasGoogleClientId: !!c.googleClientId,
    hasGoogleClientSecret: !!c.googleClientSecret,
    hasGoogleDeveloperToken: !!c.googleDeveloperToken,
    hasGoogleRefreshToken: !!c.googleRefreshToken,
    googleLoginCustomerId: c.googleLoginCustomerId,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const existing = await prisma.conexaoIntegracao.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (typeof body.nome === "string") updateData.nome = body.nome.trim();
  if (typeof body.ativo === "boolean") updateData.ativo = body.ativo;

  if (existing.plataforma === "META") {
    if (typeof body.metaAccessToken === "string" && !body.metaAccessToken.startsWith("•"))
      updateData.metaAccessToken = body.metaAccessToken.trim() || null;
  } else if (existing.plataforma === "GOOGLE_ADS") {
    if (typeof body.googleClientId === "string" && !body.googleClientId.startsWith("•"))
      updateData.googleClientId = body.googleClientId.trim() || null;
    if (typeof body.googleClientSecret === "string" && !body.googleClientSecret.startsWith("•"))
      updateData.googleClientSecret = body.googleClientSecret.trim() || null;
    if (typeof body.googleDeveloperToken === "string" && !body.googleDeveloperToken.startsWith("•"))
      updateData.googleDeveloperToken = body.googleDeveloperToken.trim() || null;
    if (typeof body.googleRefreshToken === "string" && !body.googleRefreshToken.startsWith("•"))
      updateData.googleRefreshToken = body.googleRefreshToken.trim() || null;
    if (typeof body.googleLoginCustomerId === "string")
      updateData.googleLoginCustomerId = body.googleLoginCustomerId.trim() || null;
  }

  await prisma.conexaoIntegracao.update({ where: { id }, data: updateData });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.conexaoIntegracao.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
