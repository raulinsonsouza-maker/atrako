import { NextRequest, NextResponse } from "next/server";
import { createCliente, findAllClientes, findClienteById } from "@/lib/repositories/clientesRepository";
import {
  PLATAFORMA_GOOGLE_ADS,
  PLATAFORMA_META,
  PLATAFORMA_GOOGLE_ANALYTICS,
  PLATAFORMA_INSTAGRAM,
  PLATAFORMA_LINKEDIN,
  upsertContaPlataforma,
} from "@/lib/repositories/contasRepository";
import { slugify } from "@/lib/admin/slugify";
import { syncClienteCanais } from "@/lib/sync/syncClienteCanais";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";
import { validateCommercialContext } from "@/lib/admin/clientContext";
import { ensureWorkspaceSettings } from "@/lib/config/getWorkspaceConfig";
import { createWorkspaceInvite } from "@/lib/tenancy/invites";

export async function GET(request: NextRequest) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  try {
    const clientes = await findAllClientes(false);
    return NextResponse.json(clientes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  let body: {
    nome?: string;
    slug?: string;
    logoUrl?: string;
    segmento?: string;
    ativo?: boolean;
    syncAfterCreate?: boolean;
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
    ownerEmail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const nome = body.nome?.trim();
  if (!nome) {
    return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
  }
  const slug = body.slug?.trim() || slugify(nome);
  if (!slug) {
    return NextResponse.json({ error: "slug não pôde ser gerado a partir do nome" }, { status: 400 });
  }
  let commercialContext;
  try {
    commercialContext = validateCommercialContext(body as Record<string, unknown>);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contexto comercial inválido" }, { status: 400 });
  }

  try {
    const cliente = await createCliente({
      nome,
      slug,
      logoUrl: body.logoUrl || null,
      segmento: body.segmento?.trim() || null,
      ativo: body.ativo ?? true,
      orcamentoMidiaGoogleMensal: body.orcamentoMidiaGoogleMensal ?? null,
      orcamentoMidiaMetaMensal: body.orcamentoMidiaMetaMensal ?? null,
      leadScoringEnabled: body.leadScoringEnabled ?? false,
      socialMediaAtivo: body.socialMediaAtivo ?? false,
      telegramAtivo: body.telegramAtivo ?? false,
      inPilotEnabled: body.inPilotEnabled ?? true,
      objetivoMidia: body.objetivoMidia === "ecommerce" ? "ecommerce" : "leads",
      perfilPanel: body.perfilPanel?.trim() || null,
      squad: body.squad === 1 || body.squad === 2 || body.squad === 3 ? body.squad : null,
      ...commercialContext,
    });

    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_GOOGLE_ADS,
      accountIdPlataforma: body.googleAdsAccountId,
      googleAdsLoginCustomerId: body.googleAdsLoginCustomerId,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoGoogleId ?? null,
    });
    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_META,
      accountIdPlataforma: body.metaAdsAccountId,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoMetaId ?? null,
    });
    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_GOOGLE_ANALYTICS,
      accountIdPlataforma: body.ga4PropertyId,
      nomeConta: nome,
    });
    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_INSTAGRAM,
      accountIdPlataforma: body.instagramBusinessAccountId ?? null,
      nomeConta: nome,
    });
    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_LINKEDIN,
      accountIdPlataforma: body.linkedinAdsAccountId ?? null,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoLinkedinId ?? null,
    });

    await ensureWorkspaceSettings(cliente.id);

    let ownerInvite: { acceptPath: string; email: string } | null = null;
    const ownerEmail = body.ownerEmail?.trim().toLowerCase();
    if (ownerEmail) {
      const invite = await createWorkspaceInvite({
        clienteId: cliente.id,
        email: ownerEmail,
        role: "OWNER",
      });
      ownerInvite = { acceptPath: invite.acceptPath, email: ownerEmail };
    }

    const syncAfterCreate = body.syncAfterCreate ?? true;
    let syncResult = null;
    if (syncAfterCreate && (body.ativo ?? true)) {
      syncResult = await syncClienteCanais(cliente.id);
    }

    const clienteWithContas = await findClienteById(cliente.id);
    await writeAuditLog({
      action: "CLIENT_CREATED",
      actorInternalUserId: authz.user.id,
      metadata: {
        clienteId: cliente.id,
        changedFields: Object.keys(body).sort(),
        syncRequested: syncAfterCreate,
      },
    });

    return NextResponse.json({
      cliente: clienteWithContas ?? cliente,
      sync: syncResult,
      dashboardReady: !!(syncResult && syncResult.ok),
      ownerInvite,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Já existe um cliente com esse slug." }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
