import { fetchDailyReport, fetchChannelReport } from "@/lib/analytics/ga4Client";
import {
  upsertFatoAnalyticsDiario,
  upsertFatoAnalyticsPorCanal,
} from "@/lib/repositories/fatoAnalyticsRepository";
import { findAllClientes } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";

// For brand-new clients with no data, fetch last 90 days (not all of 2026)
const DEFAULT_LOOKBACK_DAYS = 90;
// How many days back to re-fetch to capture late-arriving GA4 data
const INCREMENTAL_LOOKBACK_DAYS = 3;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

function parseGa4Date(dateStr: string): Date {
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(4, 6), 10) - 1;
  const d = parseInt(dateStr.slice(6, 8), 10);
  return new Date(y, m, d);
}

export interface AnalyticsSyncOptions {
  dateFrom?: string;
  dateTo?: string;
  propertyId?: string;
}

export interface AnalyticsSyncResult {
  daysProcessed: number;
  dateFrom: string;
  dateTo: string;
  error?: string;
}

/**
 * Sync GA4 data into FatoAnalyticsDiario and FatoAnalyticsPorCanal.
 * Incremental: detects the last saved record and goes back INCREMENTAL_LOOKBACK_DAYS
 * to capture late-arriving GA4 data. Falls back to DEFAULT_LOOKBACK_DAYS for new clients.
 */
export async function syncAnalyticsCliente(
  clienteId: string,
  options?: AnalyticsSyncOptions
): Promise<AnalyticsSyncResult> {
  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "GOOGLE_ANALYTICS" },
  });

  const propertyId = options?.propertyId ?? conta?.accountIdPlataforma;
  if (!propertyId) {
    return {
      daysProcessed: 0,
      dateFrom: "",
      dateTo: "",
      error: "Sem conta Google Analytics configurada (Conta com plataforma GOOGLE_ANALYTICS)",
    };
  }

  const today = formatDate(new Date());

  // Incremental: find the last record for this client and go back INCREMENTAL_LOOKBACK_DAYS
  let smartDateFrom = daysAgo(DEFAULT_LOOKBACK_DAYS);
  if (!options?.dateFrom) {
    const lastFato = await prisma.fatoAnalyticsDiario.findFirst({
      where: { clienteId },
      orderBy: { data: "desc" },
      select: { data: true },
    });
    if (lastFato?.data) {
      const d = new Date(lastFato.data);
      d.setDate(d.getDate() - INCREMENTAL_LOOKBACK_DAYS);
      smartDateFrom = formatDate(d);
    }
  }

  const dateFrom = options?.dateFrom ?? smartDateFrom;
  const dateTo = options?.dateTo ?? today;

  try {
    const [dailyRows, channelRows] = await Promise.all([
      fetchDailyReport(propertyId, dateFrom, dateTo),
      fetchChannelReport(propertyId, dateFrom, dateTo),
    ]);

    for (const row of dailyRows) {
      const data = parseGa4Date(row.date);
      await upsertFatoAnalyticsDiario(clienteId, data, {
        sessions: row.sessions,
        activeUsers: row.activeUsers,
        engagedSessions: row.engagedSessions,
        engagementRate: row.engagementRate,
        bounceRate: row.bounceRate,
        averageSessionDuration: row.averageSessionDuration,
        newUsers: row.newUsers,
        screenPageViews: row.screenPageViews,
        contaId: conta?.id ?? undefined,
      });
    }

    for (const row of channelRows) {
      const data = parseGa4Date(row.date);
      await upsertFatoAnalyticsPorCanal(clienteId, data, row.canal, {
        sessions: row.sessions,
        activeUsers: row.activeUsers,
      });
    }

    console.log(`[analyticsSync] clienteId=${clienteId} propertyId=${propertyId} dateFrom=${dateFrom} dateTo=${dateTo} dailyRows=${dailyRows.length} channelRows=${channelRows.length}`);

    return { daysProcessed: dailyRows.length, dateFrom, dateTo };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[analyticsSync] ERRO clienteId=${clienteId} propertyId=${propertyId}:`, message);
    return { daysProcessed: 0, dateFrom, dateTo, error: message };
  }
}

export interface AnalyticsSyncAllResult {
  clienteId: string;
  daysProcessed: number;
  dateFrom: string;
  dateTo: string;
  error?: string;
}

/**
 * Sync GA4 for all active clients with Conta GOOGLE_ANALYTICS.
 * Each client uses its own incremental date (last record - INCREMENTAL_LOOKBACK_DAYS).
 */
export async function syncAnalyticsTodosClientes(options?: { dateFrom?: string; dateTo?: string }): Promise<AnalyticsSyncAllResult[]> {
  const clientes = await findAllClientes(true);
  const results: AnalyticsSyncAllResult[] = [];

  for (const cliente of clientes) {
    const result = await syncAnalyticsCliente(cliente.id, {
      ...(options?.dateFrom ? { dateFrom: options.dateFrom } : {}),
      ...(options?.dateTo ? { dateTo: options.dateTo } : {}),
    });
    results.push({
      clienteId: cliente.id,
      daysProcessed: result.daysProcessed,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      error: result.error,
    });
  }

  return results;
}
