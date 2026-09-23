import type { GoogleAdsCampaignRow, GoogleAdsAdCreativeRow } from "@/lib/googleAds/googleAdsClient";

function parseNum(val: string | number | undefined | unknown): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const n = parseFloat(String(val).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export interface GoogleAdsCampaignPayload {
  data: Date;
  impressoes: number;
  cliques: number;
  conversoes: number;
  faturamento: number;
  investimento: number;
  alcance: number;
}

/**
 * Mapeia uma linha de campanha GAQL para o payload do FatoMidiaDiario.
 */
export function mapCampaignRowToFatoPayload(row: GoogleAdsCampaignRow): GoogleAdsCampaignPayload {
  const rowAny = row as Record<string, unknown>;
  const metrics = (row.metrics ?? rowAny.metrics) as Record<string, unknown> | undefined;
  const segments = (row.segments ?? rowAny.segments) as Record<string, unknown> | undefined;

  const costMicros = metrics?.cost_micros ?? metrics?.costMicros;
  const investimento = parseNum(costMicros) / 1_000_000;

  const impressoes = parseNum(metrics?.impressions);
  const cliques = parseNum(metrics?.clicks);
  const conversoes = parseNum(metrics?.conversions);
  // Use only conversions_value (real tracked revenue). Never fall back to
  // all_conversions_value — it includes estimated view-through, cross-device
  // and store-visit attribution that inflates numbers significantly for PMax.
  const faturamento =
    parseNum(metrics?.conversions_value ?? (metrics as Record<string, unknown>)?.conversionsValue);
  const alcance = parseNum(metrics?.unique_users ?? (metrics as Record<string, unknown>)?.uniqueUsers);

  const dateStr = segments?.date;
  const data = dateStr ? new Date(String(dateStr) + "T12:00:00Z") : new Date();

  return {
    data,
    impressoes,
    cliques,
    conversoes,
    faturamento,
    investimento,
    alcance,
  };
}

/**
 * Agrega linhas de campanha por data (soma métricas de todas as campanhas do mesmo dia).
 * Retorna um mapa data -> payload agregado.
 */
export function aggregateCampaignRowsByDate(
  rows: GoogleAdsCampaignRow[]
): Map<string, GoogleAdsCampaignPayload> {
  const byDate = new Map<string, GoogleAdsCampaignPayload>();

  for (const row of rows) {
    const payload = mapCampaignRowToFatoPayload(row);
    const key = payload.data.toISOString().slice(0, 10);

    const existing = byDate.get(key);
    if (existing) {
      existing.impressoes += payload.impressoes;
      existing.cliques += payload.cliques;
      existing.conversoes += payload.conversoes;
      existing.faturamento += payload.faturamento;
      existing.investimento += payload.investimento;
      existing.alcance += payload.alcance;
    } else {
      byDate.set(key, { ...payload });
    }
  }

  return byDate;
}

export interface GoogleAdsCampanhaPayload {
  campaignId: string;
  campaignName: string;
  campaignStatus: string | null;
  campaignType: string | null;
  data: Date;
  impressoes: number;
  cliques: number;
  custoMicros: bigint;
  conversoes: number;
  conversaoValorMicros: bigint;
  alcance: number;
}

/**
 * Mapeia uma linha de campanha GAQL preservando o breakdown por campanha (sem agregar).
 * Usado para popular a tabela GoogleAdsCampanha.
 */
export function mapCampaignRowToIndividualPayload(row: GoogleAdsCampaignRow): GoogleAdsCampanhaPayload | null {
  const rowAny = row as Record<string, unknown>;
  const campaign = (row.campaign ?? rowAny.campaign) as Record<string, unknown> | undefined;
  const metrics = (row.metrics ?? rowAny.metrics) as Record<string, unknown> | undefined;
  const segments = (row.segments ?? rowAny.segments) as Record<string, unknown> | undefined;

  const campaignId = campaign?.id != null ? String(campaign.id) : null;
  const campaignName = campaign?.name != null ? String(campaign.name) : null;
  if (!campaignId || !campaignName) return null;

  const campaignStatus = campaign?.status != null ? String(campaign.status) : null;
  const campaignType = campaign?.advertising_channel_type != null
    ? String(campaign.advertising_channel_type)
    : null;

  const costMicros = metrics?.cost_micros ?? metrics?.costMicros;
  const investimento = parseNum(costMicros) / 1_000_000;
  if (investimento <= 0) return null;

  const impressoes = parseNum(metrics?.impressions);
  const cliques = parseNum(metrics?.clicks);
  const conversoes = parseNum(metrics?.conversions);
  // Use only conversions_value (real tracked revenue). Never fall back to
  // all_conversions_value — it includes estimated view-through, cross-device
  // and store-visit attribution that inflates numbers significantly for PMax.
  const faturamento =
    parseNum(metrics?.conversions_value ?? (metrics as Record<string, unknown>)?.conversionsValue);
  const alcance = parseNum(metrics?.unique_users ?? (metrics as Record<string, unknown>)?.uniqueUsers);

  const dateStr = segments?.date;
  const data = dateStr ? new Date(String(dateStr) + "T12:00:00Z") : new Date();

  return {
    campaignId,
    campaignName,
    campaignStatus,
    campaignType,
    data,
    impressoes: Math.round(impressoes),
    cliques: Math.round(cliques),
    custoMicros: BigInt(Math.round(investimento * 1_000_000)),
    conversoes,
    conversaoValorMicros: BigInt(Math.round(faturamento * 1_000_000)),
    alcance: Math.round(alcance),
  };
}

export interface GoogleAdsCriativoPayload {
  adResourceName: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignStatus: string | null;
  adGroupId: string | null;
  adGroupName: string | null;
  headline1: string | null;
  headline2: string | null;
  description: string | null;
  finalUrls: string | null;
  data: Date;
  impressoes: number;
  cliques: number;
  custoMicros: bigint;
  conversoes: number;
  conversaoValorMicros: bigint;
}

/**
 * Mapeia uma linha de ad_group_ad GAQL para o payload do GoogleAdsCriativo.
 */
export function mapAdCreativeRowToPayload(row: GoogleAdsAdCreativeRow): GoogleAdsCriativoPayload {
  const adGroupAd = (row.ad_group_ad ?? (row as Record<string, unknown>).ad_group_ad) as Record<string, unknown> | undefined;
  const ad = adGroupAd?.ad as Record<string, unknown> | undefined;
  const campaign = (row.campaign ?? (row as Record<string, unknown>).campaign) as Record<string, unknown> | undefined;
  const adGroup = (row.ad_group ?? (row as Record<string, unknown>).ad_group) as Record<string, unknown> | undefined;
  const segments = (row.segments ?? (row as Record<string, unknown>).segments) as Record<string, unknown> | undefined;
  const metrics = (row.metrics ?? (row as Record<string, unknown>).metrics) as Record<string, unknown> | undefined;

  const resourceName = String(adGroupAd?.resource_name ?? "");

  const rsa = ad?.responsive_search_ad as { headlines?: Array<{ text?: string }>; descriptions?: Array<{ text?: string }> } | undefined;
  const eta = ad?.expanded_text_ad as Record<string, unknown> | undefined;

  let headline1: string | null = null;
  let headline2: string | null = null;
  let description: string | null = null;

  if (rsa?.headlines?.length) {
    headline1 = rsa.headlines[0]?.text ?? null;
    headline2 = rsa.headlines[1]?.text ?? null;
  }
  if (rsa?.descriptions?.length) {
    description = rsa.descriptions[0]?.text ?? null;
  }
  if (eta) {
    headline1 = headline1 ?? (eta.headline_part1 as string) ?? null;
    headline2 = headline2 ?? (eta.headline_part2 as string) ?? null;
    description = description ?? (eta.description as string) ?? null;
  }

  const finalUrlsRaw = ad?.final_urls;
  const finalUrls =
    Array.isArray(finalUrlsRaw) ? JSON.stringify(finalUrlsRaw) : finalUrlsRaw ? String(finalUrlsRaw) : null;

  const costMicros = metrics?.cost_micros ?? metrics?.costMicros ?? 0;
  const custoMicros = BigInt(parseNum(costMicros));

  const impressoes = parseNum(metrics?.impressions);
  const cliques = parseNum(metrics?.clicks);
  const conversoes = parseNum(metrics?.conversions);
  // Use only conversions_value (real tracked revenue).
  const convValorRaw =
    metrics?.conversions_value ?? (metrics as Record<string, unknown>)?.conversionsValue ?? 0;
  const conversaoValorMicros = BigInt(Math.round(parseNum(convValorRaw) * 1_000_000));

  const dateStr = segments?.date;
  const data = dateStr ? new Date(String(dateStr) + "T12:00:00Z") : new Date();

  const campaignId = campaign?.id != null ? String(campaign.id) : null;
  const campaignName = campaign?.name != null ? String(campaign.name) : null;
  const campaignStatus = campaign?.status != null ? String(campaign.status) : null;
  const adGroupId = adGroup?.id != null ? String(adGroup.id) : null;
  const adGroupName = adGroup?.name != null ? String(adGroup.name) : null;

  return {
    adResourceName: String(resourceName),
    campaignId,
    campaignName,
    campaignStatus,
    adGroupId,
    adGroupName,
    headline1,
    headline2,
    description,
    finalUrls,
    data,
    impressoes,
    cliques,
    custoMicros,
    conversoes,
    conversaoValorMicros,
  };
}
