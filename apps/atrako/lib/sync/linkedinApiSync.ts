/**
 * Sincronização diária de LinkedIn Ads — espelha o padrão Meta/Google:
 * lê métricas diárias por campanha via adAnalytics e grava em
 * LinkedInAdsCampanha (detalhe) + FatoMidiaDiario (canal "LINKEDIN", consolidado).
 *
 * Requisitos: env LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET + conexão LINKEDIN
 * com OAuth concluído no painel admin, e conta LINKEDIN vinculada ao cliente.
 * Sem credenciais, a etapa loga e pula sem falhar.
 */
import { prisma } from "@/lib/db";
import { PLATAFORMA_LINKEDIN } from "@/lib/repositories/contasRepository";
import {
  getLinkedinAppCredentials,
  getValidLinkedinAccessToken,
  fetchLinkedinCampaigns,
  fetchLinkedinDailyAnalytics,
} from "@/lib/linkedin/linkedinClient";
import { logInfo, logWarn } from "@/lib/logger";

type SyncResult = { clienteId: string; error?: string };

const LOOKBACK_DAYS = 7; // janela incremental (reprocessa últimos dias p/ atribuição tardia)
const INITIAL_DAYS = 90; // primeira carga

function dateOnlyUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseIsoDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function syncLinkedinCliente(params: {
  clienteId: string;
  contaId: string;
  adAccountId: string;
  /** Prefer accessToken (hub). conexaoId = legado CI. */
  accessToken?: string;
  conexaoId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<void> {
  const { clienteId, contaId, adAccountId } = params;
  const accessToken =
    params.accessToken ??
    (params.conexaoId ? await getValidLinkedinAccessToken(params.conexaoId) : null);
  if (!accessToken) {
    throw new Error("LinkedIn sem access token");
  }

  // Janela de sync
  const hoje = dateOnlyUTC(new Date());
  let dataInicio: Date;
  let dataFim = hoje;
  if (params.dateFrom) {
    dataInicio = parseIsoDay(params.dateFrom);
    if (params.dateTo) dataFim = parseIsoDay(params.dateTo);
  } else {
    const last = await prisma.linkedInAdsCampanha.findFirst({
      where: { clienteId },
      orderBy: { data: "desc" },
      select: { data: true },
    });
    if (last) {
      dataInicio = new Date(last.data.getTime() - LOOKBACK_DAYS * 86_400_000);
    } else {
      dataInicio = new Date(hoje.getTime() - INITIAL_DAYS * 86_400_000);
    }
  }

  const [campanhas, metricas] = await Promise.all([
    fetchLinkedinCampaigns(accessToken, adAccountId),
    fetchLinkedinDailyAnalytics(accessToken, adAccountId, dataInicio, dataFim),
  ]);
  const campanhaById = new Map(campanhas.map((c) => [c.id, c]));

  for (const m of metricas) {
    const info = campanhaById.get(m.campaignId);
    const campaignName = info?.name ?? `Campanha ${m.campaignId}`;
    const data = parseIsoDay(m.date);

    await prisma.linkedInAdsCampanha.upsert({
      where: {
        clienteId_campaignId_data: { clienteId, campaignId: m.campaignId, data },
      },
      create: {
        clienteId,
        contaId,
        campaignId: m.campaignId,
        campaignName,
        campaignStatus: info?.status ?? null,
        campaignType: info?.type ?? null,
        data,
        impressoes: m.impressions,
        cliques: m.clicks,
        custo: m.cost,
        conversoes: m.conversions,
        leads: m.leads,
      },
      update: {
        contaId,
        campaignName,
        campaignStatus: info?.status ?? null,
        campaignType: info?.type ?? null,
        impressoes: m.impressions,
        cliques: m.clicks,
        custo: m.cost,
        conversoes: m.conversions,
        leads: m.leads,
      },
    });

    // Consolidado por dia/campanha — entra automaticamente nos totais "geral"
    await prisma.fatoMidiaDiario.upsert({
      where: {
        clienteId_data_canal_campaignName: {
          clienteId,
          data,
          canal: "LINKEDIN",
          campaignName,
        },
      },
      create: {
        clienteId,
        contaId,
        data,
        canal: "LINKEDIN",
        campaignName,
        campaignId: m.campaignId,
        impressoes: m.impressions,
        cliques: m.clicks,
        leads: m.leads,
        conversoes: Math.round(m.conversions),
        investimento: m.cost,
      },
      update: {
        contaId,
        campaignId: m.campaignId,
        impressoes: m.impressions,
        cliques: m.clicks,
        leads: m.leads,
        conversoes: Math.round(m.conversions),
        investimento: m.cost,
      },
    });
  }
}

export async function syncLinkedinTodosClientes(options?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<SyncResult[]> {
  if (!(await getLinkedinAppCredentials())) {
    await logInfo(
      "LinkedIn Ads: sem credenciais (PlatformApp LINKEDIN) — etapa pulada.",
      { plataforma: "LinkedIn Ads" },
    );
    return [];
  }

  const contas = await prisma.conta.findMany({
    where: {
      plataforma: PLATAFORMA_LINKEDIN,
      accountIdPlataforma: { not: null },
      cliente: { ativo: true },
    },
    include: { conexaoIntegracao: true },
  });

  const results: SyncResult[] = [];
  const { getWorkspaceConnection } = await import("@/lib/atrako/workspace-connections");
  const { getValidLinkedinAccessTokenForWorkspace } = await import("@/lib/linkedin/linkedinClient");

  for (const conta of contas) {
    const clienteId = conta.clienteId;
    try {
      const hub = await getWorkspaceConnection(clienteId, "LINKEDIN_ADS");
      let accessToken: string | null = null;
      let conexaoId: string | undefined;
      if (hub?.credentials?.accessToken) {
        accessToken = await getValidLinkedinAccessTokenForWorkspace(clienteId);
      } else {
        const conexao = conta.conexaoIntegracao;
        if (!conexao || !conexao.ativo || conexao.plataforma !== PLATAFORMA_LINKEDIN) {
          results.push({ clienteId, error: "Sem conexão LinkedIn ativa vinculada à conta" });
          continue;
        }
        if (!conexao.linkedinAccessToken) {
          results.push({ clienteId, error: "Conexão LinkedIn sem OAuth concluído" });
          continue;
        }
        conexaoId = conexao.id;
      }
      await syncLinkedinCliente({
        clienteId,
        contaId: conta.id,
        adAccountId: conta.accountIdPlataforma!,
        accessToken: accessToken ?? undefined,
        conexaoId,
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
      });
      results.push({ clienteId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await logWarn(`LinkedIn Ads: erro em cliente ${clienteId} — ${message}`, {
        plataforma: "LinkedIn Ads",
        clienteId,
      });
      results.push({ clienteId, error: message });
    }
  }
  return results;
}

