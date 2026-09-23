import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/admin/slugify";
import {
  PLATAFORMA_GOOGLE_ADS,
  PLATAFORMA_META,
  PLATAFORMA_GOOGLE_ANALYTICS,
  PLATAFORMA_INSTAGRAM,
  PLATAFORMA_LINKEDIN,
  upsertContaPlataforma,
} from "@/lib/repositories/contasRepository";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { syncClienteCanais } from "@/lib/sync/syncClienteCanais";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";
import { validateCommercialContext } from "@/lib/admin/clientContext";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
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
    linkedinAdsAccountId?: string | null;
    conexaoLinkedinId?: string | null;
    leadScoringEnabled?: boolean;
    socialMediaAtivo?: boolean;
    telegramAtivo?: boolean;
    inPilotEnabled?: boolean;
    objetivoMidia?: string;
    perfilPanel?: string | null;
    squad?: number | null;
    produtoServico?: string | null;
    modeloNegocio?: string | null;
    publicoAlvo?: string | null;
    objetivoProjeto?: string | null;
    diferenciais?: string | null;
    observacoesAnaliticas?: string | null;
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
    telegramAtivo?: boolean;
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
  const telegramAtivo =
    body.telegramAtivo !== undefined
      ? body.telegramAtivo
      : clienteComOrcamento.telegramAtivo ?? false;
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
  const clienteComObjetivo = cliente as typeof cliente & { objetivoMidia?: string };
  const objetivoMidia =
    body.objetivoMidia !== undefined
      ? (body.objetivoMidia === "ecommerce" ? "ecommerce" : "leads")
      : clienteComObjetivo.objetivoMidia ?? "leads";
  let commercialContext;
  try {
    commercialContext = validateCommercialContext(body as Record<string, unknown>, cliente);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contexto comercial inválido" }, { status: 400 });
  }
  const clienteComInPilot = cliente as typeof cliente & { inPilotEnabled?: boolean };
  const inPilotEnabled = body.inPilotEnabled !== undefined
    ? Boolean(body.inPilotEnabled)
    : clienteComInPilot.inPilotEnabled ?? true;

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
        telegramAtivo,
        objetivoMidia,
        perfilPanel,
        squad,
        inPilotEnabled,
        ...commercialContext,
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
    const currentLinkedinConta = cliente.contas.find((conta) => conta.plataforma === PLATAFORMA_LINKEDIN);
    await upsertContaPlataforma({
      clienteId: id,
      plataforma: PLATAFORMA_LINKEDIN,
      accountIdPlataforma:
        body.linkedinAdsAccountId !== undefined
          ? body.linkedinAdsAccountId
          : currentLinkedinConta?.accountIdPlataforma,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoLinkedinId !== undefined ? body.conexaoLinkedinId : undefined,
    });

    let syncResult = null;
    if ((body.syncNow ?? true) && ativo) {
      syncResult = await syncClienteCanais(id);
    }

    const updatedCliente = await findClienteById(id);
    await writeAuditLog({
      action: "CLIENT_UPDATED",
      actorInternalUserId: authz.user.id,
      metadata: {
        clienteId: id,
        changedFields: Object.keys(body).sort(),
        syncRequested: body.syncNow ?? true,
      },
    });

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
