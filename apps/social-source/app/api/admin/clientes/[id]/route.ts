import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/admin/slugify";
import {
  PLATAFORMA_GOOGLE_ADS,
  PLATAFORMA_META,
  PLATAFORMA_GOOGLE_ANALYTICS,
  PLATAFORMA_INSTAGRAM,
  upsertContaPlataforma,
} from "@/lib/repositories/contasRepository";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { syncClienteCanais } from "@/lib/sync/syncClienteCanais";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: {
    nome?: string;
    slug?: string;
    logoUrl?: string;
    segmento?: string;
    ativo?: boolean;
    syncNow?: boolean;
    orcamentoMidiaGoogleMensal?: number;
    orcamentoMidiaMetaMensal?: number;
    googleAdsAccountId?: string | null;
    googleAdsLoginCustomerId?: string | null;
    metaAdsAccountId?: string | null;
    instagramBusinessAccountId?: string | null;
    ga4PropertyId?: string | null;
    conexaoMetaId?: string | null;
    conexaoGoogleId?: string | null;
    leadScoringEnabled?: boolean;
    socialMediaAtivo?: boolean;
    perfilPanel?: string | null;
    squad?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { contas: true },
  });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const nome = body.nome?.trim() || cliente.nome;
  const slug = (body.slug?.trim() || slugify(nome)).trim();
  const ativo = body.ativo ?? cliente.ativo;
  const logoUrl = body.logoUrl?.trim() || null;
  const segmento = body.segmento !== undefined ? (body.segmento?.trim() || null) : cliente.segmento;
  const clienteComOrcamento = cliente as typeof cliente & {
    orcamentoMidiaGoogleMensal?: number | null;
    orcamentoMidiaMetaMensal?: number | null;
    leadScoringEnabled?: boolean;
    socialMediaAtivo?: boolean;
  };
  const orcamentoMidiaGoogleMensal =
    body.orcamentoMidiaGoogleMensal !== undefined
      ? body.orcamentoMidiaGoogleMensal
      : clienteComOrcamento.orcamentoMidiaGoogleMensal ?? null;
  const orcamentoMidiaMetaMensal =
    body.orcamentoMidiaMetaMensal !== undefined
      ? body.orcamentoMidiaMetaMensal
      : clienteComOrcamento.orcamentoMidiaMetaMensal ?? null;
  const leadScoringEnabled =
    body.leadScoringEnabled !== undefined
      ? body.leadScoringEnabled
      : clienteComOrcamento.leadScoringEnabled ?? false;
  const socialMediaAtivo =
    body.socialMediaAtivo !== undefined
      ? body.socialMediaAtivo
      : clienteComOrcamento.socialMediaAtivo ?? false;
  const clienteComPerfil = cliente as typeof cliente & { perfilPanel?: string | null };
  const perfilPanel =
    body.perfilPanel !== undefined
      ? (body.perfilPanel?.trim() || null)
      : clienteComPerfil.perfilPanel ?? null;
  const clienteComSquad = cliente as typeof cliente & { squad?: number | null };
  const squad =
    body.squad !== undefined
      ? (body.squad === 1 || body.squad === 2 || body.squad === 3 ? body.squad : null)
      : clienteComSquad.squad ?? null;

  try {
    await prisma.cliente.update({
      where: { id },
      data: {
        nome,
        slug,
        logoUrl,
        segmento,
        ativo,
        orcamentoMidiaGoogleMensal,
        orcamentoMidiaMetaMensal,
        leadScoringEnabled,
        socialMediaAtivo,
        perfilPanel,
        squad,
      },
    });

    const currentGoogleConta = cliente.contas.find((conta) => conta.plataforma === PLATAFORMA_GOOGLE_ADS);
    const currentMetaConta = cliente.contas.find((conta) => conta.plataforma === PLATAFORMA_META);
    const currentAnalyticsConta = cliente.contas.find(
      (conta) => conta.plataforma === PLATAFORMA_GOOGLE_ANALYTICS
    );

    await upsertContaPlataforma({
      clienteId: id,
      plataforma: PLATAFORMA_GOOGLE_ADS,
      accountIdPlataforma:
        body.googleAdsAccountId !== undefined
          ? body.googleAdsAccountId
          : currentGoogleConta?.accountIdPlataforma,
      googleAdsLoginCustomerId:
        body.googleAdsLoginCustomerId !== undefined
          ? body.googleAdsLoginCustomerId
          : currentGoogleConta?.googleAdsLoginCustomerId,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoGoogleId !== undefined ? body.conexaoGoogleId : undefined,
    });
    await upsertContaPlataforma({
      clienteId: id,
      plataforma: PLATAFORMA_META,
      accountIdPlataforma:
        body.metaAdsAccountId !== undefined ? body.metaAdsAccountId : currentMetaConta?.accountIdPlataforma,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoMetaId !== undefined ? body.conexaoMetaId : undefined,
    });
    await upsertContaPlataforma({
      clienteId: id,
      plataforma: PLATAFORMA_GOOGLE_ANALYTICS,
      accountIdPlataforma:
        body.ga4PropertyId !== undefined ? body.ga4PropertyId : currentAnalyticsConta?.accountIdPlataforma,
      nomeConta: nome,
    });
    const currentInstagramConta = cliente.contas.find((conta) => conta.plataforma === PLATAFORMA_INSTAGRAM);
    await upsertContaPlataforma({
      clienteId: id,
      plataforma: PLATAFORMA_INSTAGRAM,
      accountIdPlataforma:
        body.instagramBusinessAccountId !== undefined
          ? body.instagramBusinessAccountId
          : currentInstagramConta?.accountIdPlataforma,
      nomeConta: nome,
    });

    let syncResult = null;
    if ((body.syncNow ?? true) && ativo) {
      syncResult = await syncClienteCanais(id);
    }

    const updatedCliente = await findClienteById(id);

    return NextResponse.json({
      cliente: updatedCliente,
      sync: syncResult,
      dashboardReady: !!(syncResult && syncResult.ok),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Já existe um cliente com esse slug." }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
