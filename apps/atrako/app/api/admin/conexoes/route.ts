import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function GET(req: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

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
      hasLinkedinAccessToken: !!c.linkedinAccessToken,
      linkedinTokenExpiresAt: c.linkedinTokenExpiresAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

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
  if (!["META", "GOOGLE_ADS", "LINKEDIN"].includes(body.plataforma))
    return NextResponse.json({ error: "Plataforma inválida (META, GOOGLE_ADS ou LINKEDIN)" }, { status: 400 });

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
  await writeAuditLog({
    action: "INTEGRATION_CONNECTION_CREATED",
    actorInternalUserId: access.user.id,
    metadata: {
      targetResourceId: conexao.id,
      operationType: "create",
      changedFields: ["nome", "plataforma", "ativo", "credentials"],
    },
  });

  return NextResponse.json({ ok: true, id: conexao.id });
}
