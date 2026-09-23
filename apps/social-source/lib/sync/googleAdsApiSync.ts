import {
  fetchCampaignMetrics,
  fetchAdCreatives,
  fetchBeginCheckoutConversions,
  fetchPurchaseConversions,
} from "@/lib/googleAds/googleAdsClient";
import {
  aggregateCampaignRowsByDate,
  mapAdCreativeRowToPayload,
  mapCampaignRowToIndividualPayload,
} from "@/lib/mappers/googleAdsToDomain";
import { upsertFatoMidia } from "@/lib/repositories/fatosMidiaRepository";
import { upsertGoogleAdsCriativo } from "@/lib/repositories/googleAdsCriativosRepository";
import { upsertGoogleAdsCampanha } from "@/lib/repositories/googleAdsCampanhasRepository";
import { findAllClientes } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";
import { resolveGoogleAdsCredentials } from "@/lib/config/resolveIntegracao";

/** Extract a human-readable message from google-ads-api errors (which are often non-Error objects). */
function extractGoogleAdsError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const first = obj.errors[0] as Record<string, unknown>;
      if (typeof first.message === "string") return first.message;
      return JSON.stringify(first);
    }
    if (Array.isArray(obj.details) && obj.details.length > 0) {
      const first = obj.details[0] as Record<string, unknown>;
      if (typeof first.message === "string") return first.message;
    }
    try { return JSON.stringify(obj); } catch { /* fall through */ }
  }
  return String(e);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Baseline para a primeira sync de um cliente sem dados — alinhado com a Meta
// (DEFAULT_DATE_FROM em metaApiSync.ts) para que ambos os canais cubram o ano todo.
const DEFAULT_DATE_FROM = "2026-01-01";

function getDefaultDateFrom(): string {
  return DEFAULT_DATE_FROM;
}

export interface GoogleAdsSyncOptions {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
}

export interface GoogleAdsSyncResult {
  daysProcessed: number;
  error?: string;
}

export async function syncGoogleAdsCliente(
  clienteId: string,
  options?: GoogleAdsSyncOptions
): Promise<GoogleAdsSyncResult> {
  const [resolved, conta] = await Promise.all([
    resolveGoogleAdsCredentials(clienteId),
    prisma.conta.findFirst({ where: { clienteId, plataforma: "GOOGLE_ADS" } }),
  ]);

  if (!resolved) {
    return { daysProcessed: 0, error: "Credenciais Google Ads não configuradas" };
  }

  const customerId = options?.customerId ?? conta?.accountIdPlataforma;
  if (!customerId) {
    return { daysProcessed: 0, error: "Sem conta Google Ads configurada (Conta com plataforma GOOGLE_ADS)" };
  }

  const today = formatDate(new Date());

  // Sync incremental: detectar última data salva no banco para não rebuscar 90 dias sempre
  let smartDateFrom = getDefaultDateFrom();
  if (!options?.dateFrom) {
    const lastFato = await prisma.fatoMidiaDiario.findFirst({
      where: { clienteId, canal: "GOOGLE" },
      orderBy: { data: "desc" },
      select: { data: true },
    });
    if (lastFato?.data) {
      // Volta 3 dias atrás — Google Ads pode atrasar até 72h em conversões e ajustes
      const d = new Date(lastFato.data);
      d.setDate(d.getDate() - 3);
      smartDateFrom = formatDate(d);
    }
  }

  const dateFrom = options?.dateFrom ?? smartDateFrom;
  const dateTo = options?.dateTo ?? today;

  try {
    const loginCustomerId = conta?.googleAdsLoginCustomerId ?? resolved.loginCustomerId ?? undefined;
    const credOverride = { ...resolved };
    const [campaignRows, creativeRows, checkoutByDate, purchaseByDate] = await Promise.all([
      fetchCampaignMetrics(customerId, dateFrom, dateTo, {
        loginCustomerId,
        credentials: credOverride,
      }),
      fetchAdCreatives(customerId, dateFrom, dateTo, {
        loginCustomerId,
        credentials: credOverride,
      }),
      fetchBeginCheckoutConversions(customerId, dateFrom, dateTo, {
        loginCustomerId,
        credentials: credOverride,
      }),
      fetchPurchaseConversions(customerId, dateFrom, dateTo, {
        loginCustomerId,
        credentials: credOverride,
      }),
    ]);

    const byDate = aggregateCampaignRowsByDate(campaignRows);
    for (const [, payload] of byDate) {
      const dateKey = payload.data.toISOString().slice(0, 10);
      const checkoutIniciado = checkoutByDate.get(dateKey) ?? 0;
      const conv = Math.round(payload.conversoes);
      const purchaseData = purchaseByDate.get(dateKey);
      const purchases = purchaseData ? Math.round(purchaseData.count) : 0;
      const purchaseValue = purchaseData?.value ?? 0;

      await upsertFatoMidia(clienteId, payload.data, "GOOGLE", {
        impressoes: payload.impressoes,
        cliques: payload.cliques,
        leads: conv,
        conversoes: conv,
        purchases,
        investimento: payload.investimento,
        websitePurchasesConversionValue: purchaseValue,
        alcance: payload.alcance,
        checkoutIniciado: Math.round(checkoutIniciado),
        contaId: conta?.id ?? undefined,
      });
    }

    for (const row of campaignRows) {
      const campPayload = mapCampaignRowToIndividualPayload(row);
      if (campPayload) {
        await upsertGoogleAdsCampanha(clienteId, {
          ...campPayload,
          contaId: conta?.id ?? undefined,
        });
      }
    }

    for (const row of creativeRows) {
      const payload = mapAdCreativeRowToPayload(row);
      await upsertGoogleAdsCriativo(clienteId, {
        ...payload,
        contaId: conta?.id ?? undefined,
      });
    }

    console.log(`[googleAdsSync] clienteId=${clienteId} customerId=${customerId} dateFrom=${dateFrom} dateTo=${dateTo} days=${byDate.size} campaigns=${campaignRows.length} creatives=${creativeRows.length}`);
    return { daysProcessed: byDate.size };
  } catch (e) {
    const message = extractGoogleAdsError(e);
    console.error(`[googleAdsSync] ERRO clienteId=${clienteId} customerId=${customerId}:`, message);
    return { daysProcessed: 0, error: message };
  }
}

export interface GoogleAdsSyncAllResult {
  clienteId: string;
  daysProcessed: number;
  error?: string;
}

export async function syncGoogleAdsTodosClientes(options?: { dateFrom?: string; dateTo?: string }): Promise<GoogleAdsSyncAllResult[]> {
  const clientes = await findAllClientes(true);
  const today = formatDate(new Date());
  const results: GoogleAdsSyncAllResult[] = [];

  for (const cliente of clientes) {
    // Sem dateFrom explícito → cada cliente detecta sua própria data incremental
    const result = await syncGoogleAdsCliente(cliente.id, {
      ...(options?.dateFrom ? { dateFrom: options.dateFrom } : {}),
      dateTo: options?.dateTo ?? today,
    });
    results.push({
      clienteId: cliente.id,
      daysProcessed: result.daysProcessed,
      error: result.error,
    });
  }

  return results;
}
