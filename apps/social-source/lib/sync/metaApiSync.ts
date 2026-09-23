import { fetchCampaignInsightsAggregatedByDay, fetchCampaignInsightsPerCampaign, fetchAdsWithCreatives } from "@/lib/meta/metaClient";
import { mapMetaInsightToFatoPayload } from "@/lib/mappers/metaToDomain";
import { upsertFatoMidia } from "@/lib/repositories/fatosMidiaRepository";
import { upsertMetaAdsCriativo } from "@/lib/repositories/metaAdsCriativosRepository";
import { findAllClientes } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { isFlorien } from "@/lib/clientProfiles";

const DEFAULT_DATE_FROM = "2026-01-01";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface MetaSyncOptions {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  creativeDateFrom?: string;
  creativeDateTo?: string;
}

export interface MetaSyncResult {
  daysProcessed: number;
  creativesProcessed: number;
  error?: string;
}

/**
 * Sync META channel data from Meta Marketing API into FatoMidiaDiario.
 * Uses default date range from 2026-01-01 to today unless overridden.
 */
export async function syncMetaCliente(
  clienteId: string,
  options?: MetaSyncOptions
): Promise<MetaSyncResult> {
  const resolved = await resolveMetaCredentials(clienteId);
  if (!resolved) {
    return { daysProcessed: 0, creativesProcessed: 0, error: "META_ACCESS_TOKEN não configurado" };
  }
  const token = resolved.token;
  const accountId = options?.accountId ?? resolved.accountId;
  if (!accountId) {
    return { daysProcessed: 0, creativesProcessed: 0, error: "META_AD_ACCOUNT_ID não configurado" };
  }

  const today = formatDate(new Date());

  // Sync incremental: detectar última data salva no banco para não rebuscar tudo desde jan/01
  let smartDateFrom = DEFAULT_DATE_FROM;
  if (!options?.dateFrom) {
    const lastFato = await prisma.fatoMidiaDiario.findFirst({
      where: { clienteId, canal: "META" },
      orderBy: { data: "desc" },
      select: { data: true },
    });
    if (lastFato?.data) {
      // Volta 3 dias atrás — Meta pode atrasar até 72h em dados de campanhas e conversões
      const d = new Date(lastFato.data);
      d.setDate(d.getDate() - 3);
      smartDateFrom = formatDate(d);
    }
  }

  const dateFrom = options?.dateFrom ?? smartDateFrom;
  const dateTo = options?.dateTo ?? today;

  // Criativos: insights agregados desde DEFAULT_DATE_FROM até hoje, para que cada
  // snapshot contenha o total de vida do anúncio (e não só os últimos 7 dias).
  // O filtro `effective_status` em fetchAdsWithCreatives garante que ads ativos
  // sejam capturados independentemente da janela de insights.
  const creativeDateFrom = options?.creativeDateFrom ?? DEFAULT_DATE_FROM;
  const creativeDateTo = options?.creativeDateTo ?? today;

  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { nome: true, slug: true, perfilPanel: true } });
    // Florien: campaign-level aggregated by day (profile visits metric, no per-campaign rows)
    const useCampaignAggregated = isFlorien(cliente);

    let rows: Awaited<ReturnType<typeof fetchCampaignInsightsPerCampaign>>;
    if (useCampaignAggregated) {
      const resp = await fetchCampaignInsightsAggregatedByDay(accountId, token, dateFrom, dateTo);
      rows = resp.data ?? [];
    } else {
      // All other clients: per-campaign rows with campaign_name stored separately
      rows = await fetchCampaignInsightsPerCampaign(accountId, token, dateFrom, dateTo);
    }

    let contaId: string | null = null;
    const conta = await prisma.conta.findFirst({
      where: { clienteId, plataforma: "META", accountIdPlataforma: accountId },
    });
    if (conta) contaId = conta.id;

    // Remove ALL old aggregate rows (campaignName="") so they don't pollute campaign breakdowns.
    if (!useCampaignAggregated && rows.length > 0) {
      await prisma.fatoMidiaDiario.deleteMany({
        where: { clienteId, canal: "META", campaignName: "" },
      });
    }

    // Detect renamed campaigns: build a map of campaignId → latest campaignName from the API response.
    // If a campaign was renamed, its old-name rows still exist in DB; we delete them before upserting new ones.
    if (!useCampaignAggregated && rows.length > 0) {
      const idToNewName = new Map<string, string>();
      for (const row of rows) {
        const cid = row.campaign_id?.trim();
        const cname = row.campaign_name?.trim() ?? "";
        if (cid) idToNewName.set(cid, cname);
      }

      if (idToNewName.size > 0) {
        const campaignIds = [...idToNewName.keys()];
        // Find rows whose campaignId is known but campaignName differs from the current API value
        const staleRows = await prisma.fatoMidiaDiario.findMany({
          where: {
            clienteId,
            canal: "META",
            campaignId: { in: campaignIds, not: "" },
          },
          select: { id: true, campaignId: true, campaignName: true },
        });

        const staleIds: string[] = [];
        for (const row of staleRows) {
          const currentName = idToNewName.get(row.campaignId);
          if (currentName !== undefined && row.campaignName !== currentName) {
            staleIds.push(row.id);
          }
        }

        if (staleIds.length > 0) {
          console.log(`[syncMetaCliente] Limpando ${staleIds.length} linhas com nomes de campanha desatualizados (campanhas renomeadas)`);
          await prisma.fatoMidiaDiario.deleteMany({ where: { id: { in: staleIds } } });
        }
      }
    }

    for (const row of rows) {
      const payload = mapMetaInsightToFatoPayload(row);
      await upsertFatoMidia(clienteId, payload.data, "META", {
        impressoes: payload.impressoes,
        cliques: payload.cliques,
        leads: payload.leads,
        conversoes: payload.conversoes,
        onFacebookLeads: payload.onFacebookLeads,
        websiteLeads: payload.websiteLeads,
        messagingConversationsStarted: payload.messagingConversationsStarted,
        contacts: payload.contacts,
        purchases: payload.purchases,
        investimento: payload.investimento,
        cpl: payload.cpl,
        costPerPurchase: payload.costPerPurchase,
        websitePurchaseRoas: payload.websitePurchaseRoas,
        websitePurchasesConversionValue: payload.websitePurchasesConversionValue,
        alcance: payload.alcance,
        checkoutIniciado: payload.checkoutIniciado,
        profileVisits: payload.profileVisits,
        addToCart: payload.addToCart,
        landingPageViews: payload.landingPageViews,
        contaId: contaId ?? undefined,
        campaignName: payload.campaignName,
        campaignId: payload.campaignId,
      });
    }

    // Criativos: fetch isolado — falha de rate-limit aqui NÃO invalida os dados de
    // campanha já gravados acima. Se o Meta API estiver sobrecarregado neste momento,
    // os criativos ficam desatualizados mas o investimento/conversões permanecem.
    let ads: Awaited<ReturnType<typeof fetchAdsWithCreatives>> = [];
    try {
      ads = await fetchAdsWithCreatives(accountId, token, {
        dateFrom: creativeDateFrom,
        dateTo: creativeDateTo,
      });
    } catch (creativeErr) {
      const creativeMsg = creativeErr instanceof Error ? creativeErr.message : String(creativeErr);
      console.warn(`[metaSync] criativos falhou (não-fatal) clienteId=${clienteId} accountId=${accountId}:`, creativeMsg);
    }

    // Helpers para extrair conversões dos arrays actions/action_values
    const getAction = (arr: Array<{ action_type: string; value: string }> | undefined, type: string) =>
      parseInt(arr?.find(a => a.action_type === type)?.value ?? "0", 10) || 0;
    const getActionValue = (arr: Array<{ action_type: string; value: string }> | undefined, type: string) =>
      parseFloat(arr?.find(a => a.action_type === type)?.value ?? "0") || 0;

    let dailyRowsWritten = 0;
    for (const ad of ads) {
      const creative = ad.adcreatives?.data?.[0];
      if (!creative) continue;

      const insightRows = ad.insights?.data ?? [];
      // Se a Meta não retornou nenhum dia (ad sem entrega no período),
      // ainda gravamos uma linha-zero para o creativeDateTo para preservar
      // a presença do anúncio no painel.
      const rowsToPersist = insightRows.length > 0
        ? insightRows
        : [{ date_start: creativeDateTo, date_stop: creativeDateTo } as typeof insightRows[number]];

      for (const insight of rowsToPersist) {
        const dayStr = insight.date_start ?? insight.date_stop ?? creativeDateTo;
        const rowDate = new Date(`${dayStr}T00:00:00`);
        const actions = insight.actions ?? [];
        const actionValues = insight.action_values ?? [];

        const leads =
          getAction(actions, "lead") ||
          getAction(actions, "onsite_conversion.lead_grouped") ||
          getAction(actions, "offsite_conversion.fb_pixel_lead") ||
          getAction(actions, "website_lead");

        const purchases =
          getAction(actions, "purchase") ||
          getAction(actions, "omni_purchase") ||
          getAction(actions, "offsite_conversion.fb_pixel_purchase") ||
          getAction(actions, "website_purchase");

        const revenue =
          getActionValue(actionValues, "purchase") ||
          getActionValue(actionValues, "omni_purchase") ||
          getActionValue(actionValues, "offsite_conversion.fb_pixel_purchase") ||
          getActionValue(actionValues, "website_purchase");

        const messagingConversationsStarted =
          getAction(actions, "onsite_conversion.messaging_conversation_started_7d") ||
          getAction(actions, "messaging_conversation_started_7d");

        await upsertMetaAdsCriativo(clienteId, {
          data: rowDate,
          adId: ad.id,
          creativeId: creative.id,
          adName: ad.name,
          effectiveStatus: ad.effective_status ?? null,
          campaignId: ad.adset?.campaign?.id ?? null,
          campaignName: ad.adset?.campaign?.name ?? null,
          adsetId: ad.adset?.id ?? null,
          adsetName: ad.adset?.name ?? null,
          campaignObjective: ad.adset?.campaign?.objective ?? null,
          mediaType: creative.video_source_url || creative.video_id ? "VIDEO" : "IMAGE",
          imageUrl: creative.image_url_full ?? creative.thumbnail_url ?? creative.image_url ?? null,
          imageUrlFull: creative.image_url_full ?? null,
          videoId: creative.video_id ?? null,
          videoSourceUrl: creative.video_source_url ?? null,
          videoPictureUrl: creative.video_picture_url ?? null,
          videoEmbedHtml: (creative as { video_embed_html?: string }).video_embed_html ?? null,
          body: creative.body ?? null,
          title: creative.title ?? null,
          spend: insight.spend ? parseFloat(insight.spend) : 0,
          impressions: insight.impressions ? parseInt(insight.impressions, 10) : 0,
          clicks: insight.clicks ? parseInt(insight.clicks, 10) : 0,
          leads,
          purchases,
          websitePurchasesConversionValue: revenue,
          messagingConversationsStarted,
          ctr: insight.ctr ? parseFloat(insight.ctr) : null,
          cpc: insight.cpc ? parseFloat(insight.cpc) : null,
          contaId,
        });
        dailyRowsWritten += 1;
      }
    }

    console.log(`[metaSync] clienteId=${clienteId} accountId=${accountId} dateFrom=${dateFrom} dateTo=${dateTo} rows=${rows.length} creatives=${ads.length} dailyAdRows=${dailyRowsWritten}`);
    return { daysProcessed: rows.length, creativesProcessed: ads.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[metaSync] ERRO clienteId=${clienteId} accountId=${accountId}:`, message);
    return { daysProcessed: 0, creativesProcessed: 0, error: message };
  }
}

export interface MetaSyncAllResult {
  clienteId: string;
  daysProcessed: number;
  creativesProcessed: number;
  error?: string;
}

/**
 * Sync META for all active clients. Uses Conta META when available, else META_AD_ACCOUNT_ID.
 */
export async function syncMetaTodosClientes(options?: { dateFrom?: string; dateTo?: string }): Promise<MetaSyncAllResult[]> {
  const fromDb = await getIntegrationsConfig();
  const token = fromDb.metaAccessToken ?? process.env.META_ACCESS_TOKEN;
  const defaultAccountId = fromDb.metaAdAccountId ?? process.env.META_AD_ACCOUNT_ID;

  if (!token) {
    return [{ clienteId: "_", daysProcessed: 0, creativesProcessed: 0, error: "META_ACCESS_TOKEN não configurado" }];
  }

  const clientes = await findAllClientes(true);
  const today = formatDate(new Date());
  const results: MetaSyncAllResult[] = [];

  for (const cliente of clientes) {
    const conta = await prisma.conta.findFirst({
      where: { clienteId: cliente.id, plataforma: "META" },
    });
    const accountId = conta?.accountIdPlataforma ?? defaultAccountId;
    if (!accountId) {
      results.push({ clienteId: cliente.id, daysProcessed: 0, creativesProcessed: 0, error: "Sem conta Meta configurada" });
      continue;
    }

    // Se um dateFrom global foi passado (ex: force-resync), usa ele.
    // Caso contrário, o syncMetaCliente detecta automaticamente a data incremental.
    const result = await syncMetaCliente(cliente.id, {
      ...(options?.dateFrom ? { dateFrom: options.dateFrom, creativeDateFrom: options.dateFrom } : {}),
      dateTo: options?.dateTo ?? today,
      accountId,
    });
    results.push({
      clienteId: cliente.id,
      daysProcessed: result.daysProcessed,
      creativesProcessed: result.creativesProcessed,
      error: result.error,
    });
  }

  return results;
}
