/**
 * Sincronização de insights mensais do Instagram para o banco de dados.
 * Busca os últimos 13 meses de alcance, engajamento e novos seguidores
 * via Instagram Graph API e persiste em InstagramInsightMensal (upsert).
 *
 * Chamado pelo runDailySync após o sync Meta Ads.
 */
import { prisma } from "@/lib/db";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { discoverInstagramId } from "@/lib/sync/discoverInstagramId";
import { isSyntheticDemoCliente } from "@/lib/demo/syntheticDemo";

const GRAPH = "https://graph.facebook.com/v22.0";

export interface InstagramSyncResult {
  clienteId: string;
  configured?: boolean;
  monthsProcessed?: number;
  error?: string;
}

function toUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

async function igGet(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const sp = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH}/${path}?${sp}`);
  const json = (await res.json()) as Record<string, unknown>;
  if (json.error) {
    const err = json.error as { message?: string };
    throw new Error(`IG API: ${err.message ?? String(json.error)}`);
  }
  return json;
}

/**
 * Sincroniza insights mensais do Instagram de um único cliente.
 */
export async function syncInstagramCliente(
  clienteId: string,
): Promise<InstagramSyncResult> {
  if (await isSyntheticDemoCliente(clienteId)) {
    return { clienteId };
  }
  const igId = await discoverInstagramId(clienteId);
  if (!igId) {
    return { clienteId, configured: false };
  }

  const creds = await resolveMetaCredentials(clienteId);
  if (!creds?.token) {
    return { clienteId, error: "Sem credenciais Meta configuradas" };
  }
  const token = creds.token;

  try {
    const now = new Date();

    // Profile (followers total)
    const profileRaw = await igGet(igId, token, { fields: "followers_count,name" });
    const followersTotal = (profileRaw.followers_count as number) ?? 0;

    // Instagram Insights API constraints (v22+):
    // • since→until window must be ≤30 days → we use 28-day windows
    // • reach: period=day, values[] array (daily values to sum) — valid for account + REELS
    // • total_interactions: period=day + metric_type=total_value → data[0].total_value.value
    // • follower_count: period=day, values[] (daily new followers to sum); only last 30 days
    // • views: substitui `impressions`, removida dos insights de conta no Graph API v22

    type MonthBucket = {
      ano: number;
      mes: number;
      alcance: number;
      engajamento: number;
      novosSeguidores: number;
      impressoes: number;
      hasFollowerData: boolean;
      hasReachData: boolean;
      hasEngagementData: boolean;
      hasViewsData: boolean;
    };

    const monthMap = new Map<string, MonthBucket>();
    const monthlyErrors = new Set<string>();
    // follower_count API only supports the last ~30 days — flag months inside this window
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let i = 12; i >= 0; i--) {
      const since = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (since > now) continue;
      const nextMonth = new Date(since.getFullYear(), since.getMonth() + 1, 1);
      const until = new Date(Math.min(nextMonth.getTime() - 1000, now.getTime()));
      const s = String(toUnix(since));
      const u = String(toUnix(until));
      const ano = since.getFullYear();
      const mes = since.getMonth() + 1;
      const key = `${ano}-${String(mes).padStart(2, "0")}`;
      const isWithin30Days = since >= cutoff30;

      const safeInsight = async (
        metric: string,
        params: Record<string, string>,
      ): Promise<Record<string, unknown> | null> => {
        try {
          return await igGet(`${igId}/insights`, token, { metric, ...params });
        } catch (error) {
          monthlyErrors.add(metric);
          console.warn("[instagram-sync] Insight indisponível", {
            clienteId,
            igId,
            metric,
            ano,
            mes,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      };

      const [r1, r2, r3, r4] = await Promise.all([
        // reach with metric_type=total_value → deduplicated unique accounts for the period
        // (same number the IG platform shows as "Contas alcançadas")
        safeInsight("reach", {
          period: "day",
          metric_type: "total_value",
          since: s,
          until: u,
        }),
        safeInsight("accounts_engaged", {
          period: "day",
          since: s,
          until: u,
          metric_type: "total_value",
        }),
        // follower_count only supported for last ~30 days; older months silently return empty
        safeInsight("follower_count", {
          period: "day",
          since: s,
          until: u,
        }),
        safeInsight("views", {
          period: "day",
          since: s,
          until: u,
          metric_type: "total_value",
        }),
      ]);

      type DailyValue = { value: number; end_time: string };
      type TotalValueEntry = { total_value?: { value: number } };

      // reach: now uses total_value (deduplicated period reach, matches IG platform)
      const alcanceValue = ((r1?.data as TotalValueEntry[] | undefined)?.[0]?.total_value?.value);
      const alcance = alcanceValue ?? 0;
      const hasReachData = typeof alcanceValue === "number";

      const engagementValue = ((r2?.data as TotalValueEntry[] | undefined)?.[0]?.total_value?.value);
      const engajamento = engagementValue ?? 0;
      const hasEngagementData = typeof engagementValue === "number";

      const followValues = (r3?.data as Array<{ values?: DailyValue[] }> | undefined)?.[0]?.values ?? [];
      const novosSeguidores = followValues.reduce((sum, v) => sum + (v.value ?? 0), 0);
      const hasFollowerData = isWithin30Days && followValues.length > 0;

      // Persistido no campo legado `impressoes`, mas representa a métrica oficial `views`.
      const viewsValue = ((r4?.data as TotalValueEntry[] | undefined)?.[0]?.total_value?.value);
      const impressoes = viewsValue ?? 0;
      const hasViewsData = typeof viewsValue === "number";

      monthMap.set(key, {
        ano, mes, alcance, engajamento, novosSeguidores, impressoes,
        hasFollowerData, hasReachData, hasEngagementData, hasViewsData,
      });
    }

    const syncedAt = new Date();
    const upserts = [...monthMap.values()].map((bucket) =>
      prisma.instagramInsightMensal.upsert({
        where: { clienteId_ano_mes: { clienteId, ano: bucket.ano, mes: bucket.mes } },
        create: {
          clienteId,
          ano: bucket.ano,
          mes: bucket.mes,
          ...(bucket.hasReachData ? { alcance: bucket.alcance } : {}),
          ...(bucket.hasEngagementData ? { engajamento: bucket.engajamento } : {}),
          novosSeguidores: bucket.novosSeguidores,
          followersTotal,
          ...(bucket.hasViewsData ? { impressoes: bucket.impressoes } : {}),
          syncedAt,
        },
        update: {
          ...(bucket.hasReachData ? { alcance: bucket.alcance } : {}),
          ...(bucket.hasEngagementData ? { engajamento: bucket.engajamento } : {}),
          // Only overwrite novosSeguidores when the API actually returned data for this month.
          // follower_count is limited to the last ~30 days; older months return empty and
          // must NOT overwrite previously correct values with 0.
          ...(bucket.hasFollowerData ? { novosSeguidores: bucket.novosSeguidores } : {}),
          followersTotal,
          ...(bucket.hasViewsData ? { impressoes: bucket.impressoes } : {}),
          syncedAt,
        },
      }),
    );

    await Promise.all(upserts);

    // --- Daily sync: recent supported window ---
    const dailyError = await syncInstagramDiario(clienteId, igId, token, followersTotal);
    const syncErrors = [
      monthlyErrors.size > 0
        ? `Métricas mensais indisponíveis: ${[...monthlyErrors].join(", ")}`
        : null,
      dailyError,
    ].filter((value): value is string => Boolean(value));
    if (syncErrors.length > 0) {
      return {
        clienteId,
        configured: true,
        monthsProcessed: monthMap.size,
        error: syncErrors.join(". "),
      };
    }

    return { clienteId, configured: true, monthsProcessed: monthMap.size };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { clienteId, error: msg };
  }
}

/**
 * Busca os últimos 30 dias de dados diários do Instagram e persiste em
 * InstagramInsightDiario (upsert). Chamado dentro de syncInstagramCliente.
 */
async function syncInstagramDiario(
  clienteId: string,
  igId: string,
  token: string,
  liveFollowersTotal: number,
): Promise<string | null> {
  try {
    const now = new Date();
    const since30 = new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000);
    since30.setHours(0, 0, 0, 0);

    const s = String(toUnix(since30));
    const u = String(toUnix(now));

    const safeDailyInsight = async (
      metric: string,
      params: Record<string, string>,
    ): Promise<Record<string, unknown> | null> => {
      try {
        return await igGet(`${igId}/insights`, token, { metric, ...params });
      } catch (error) {
        console.warn("[instagram-sync] Insight diário indisponível", {
          clienteId,
          igId,
          metric,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    };

    const rFollower = await safeDailyInsight("follower_count", {
      period: "day",
      since: s,
      until: u,
    });

    type DailyValue = { value: number; end_time: string };
    const followerValues= (rFollower?.data as Array<{ values?: DailyValue[] }> | undefined)?.[0]?.values ?? [];

    const followerMap= new Map<string, number>();

    for (const v of followerValues) followerMap.set(v.end_time.slice(0, 10), v.value ?? 0);

    if (followerMap.size === 0) {
      return "Instagram não retornou dados diários no período suportado";
    }

    const sortedDates = [...followerMap.keys()]
      .filter(d => d >= since30.toISOString().slice(0, 10))
      .sort();

    // Back-calculate followersTotal anchor: liveTotal - sum(all gains) = base before window
    const totalGainsSum = sortedDates.reduce((s, d) => s + (followerMap.get(d) ?? 0), 0);
    let running = liveFollowersTotal - totalGainsSum;

    const syncedAt = new Date();
    const upserts = sortedDates.map(dateStr => {
      running += followerMap.get(dateStr) ?? 0;
      const ft = running;
      return prisma.instagramInsightDiario.upsert({
        where: { clienteId_data: { clienteId, data: new Date(dateStr + "T12:00:00Z") } },
        create: {
          clienteId,
          data: new Date(dateStr + "T12:00:00Z"),
          novosSeguidores: followerMap.get(dateStr) ?? 0,
          followersTotal: ft,
          syncedAt,
        },
        update: {
          novosSeguidores: followerMap.get(dateStr) ?? 0,
          followersTotal: ft,
          syncedAt,
        },
      });
    });

    await Promise.all(upserts);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Sincroniza Instagram de todos os clientes que têm conta INSTAGRAM configurada.
 */
export async function syncInstagramTodosClientes(): Promise<
  InstagramSyncResult[]
> {
  const contas = await prisma.conta.findMany({
    where: { plataforma: "INSTAGRAM", accountIdPlataforma: { not: null } },
    select: { clienteId: true },
    distinct: ["clienteId"],
  });

  const results: InstagramSyncResult[] = [];
  for (const { clienteId } of contas) {
    const result = await syncInstagramCliente(clienteId);
    results.push(result);
  }
  return results;
}
