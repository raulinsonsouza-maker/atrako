import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conexoes = await prisma.conexaoIntegracao.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { contas: true } } },
  });

  return NextResponse.json(
    conexoes.map((c) => ({
      id: c.id,
      nome: c.nome,
      plataforma: c.plataforma,
      ativo: c.ativo,
      contasCount: c._count.contas,
      hasMetaAccessToken: !!c.metaAccessToken,
      hasGoogleClientId: !!c.googleClientId,
      hasGoogleRefreshToken: !!c.googleRefreshToken,
      googleLoginCustomerId: c.googleLoginCustomerId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    nome: string;
    plataforma: string;
    ativo?: boolean;
    metaAccessToken?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    googleDeveloperToken?: string;
    googleRefreshToken?: string;
    googleLoginCustomerId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!["META", "GOOGLE_ADS"].includes(body.plataforma))
    return NextResponse.json({ error: "Plataforma inválida (META ou GOOGLE_ADS)" }, { status: 400 });

  const conexao = await prisma.conexaoIntegracao.create({
    data: {
      nome: body.nome.trim(),
      plataforma: body.plataforma,
      ativo: body.ativo ?? true,
      metaAccessToken: body.metaAccessToken?.trim() || null,
      googleClientId: body.googleClientId?.trim() || null,
      googleClientSecret: body.googleClientSecret?.trim() || null,
      googleDeveloperToken: body.googleDeveloperToken?.trim() || null,
      googleRefreshToken: body.googleRefreshToken?.trim() || null,
      googleLoginCustomerId: body.googleLoginCustomerId?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, id: conexao.id });
}
