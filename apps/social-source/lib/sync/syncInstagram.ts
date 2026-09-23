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

const GRAPH = "https://graph.facebook.com/v19.0";

export interface InstagramSyncResult {
  clienteId: string;
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
  const igId = await discoverInstagramId(clienteId);
  if (!igId) {
    return { clienteId, error: "Sem conta Instagram configurada" };
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

    // Instagram Insights API constraints (v19+):
    // • since→until window must be ≤30 days → we use 28-day windows
    // • reach: period=day, values[] array (daily values to sum)
    // • total_interactions: period=day + metric_type=total_value → data[0].total_value.value
    // • follower_count: period=day, values[] (daily new followers to sum); only last 30 days
    // • new_follows / month period removed from API

    type MonthBucket = {
      ano: number;
      mes: number;
      alcance: number;
      engajamento: number;
      novosSeguidores: number;
    };

    const monthMap = new Map<string, MonthBucket>();

    for (let i = 12; i >= 0; i--) {
      const since = new Date(now.getFullYear(), now.getMonth() - i, 1);
      // 28-day window — always ≤30 days regardless of month length
      const until = new Date(since.getTime() + 28 * 24 * 60 * 60 * 1000);
      const s = String(toUnix(since));
      const u = String(toUnix(until));
      const ano = since.getFullYear();
      const mes = since.getMonth() + 1;
      const key = `${ano}-${String(mes).padStart(2, "0")}`;

      const [r1, r2, r3] = await Promise.all([
        igGet(`${igId}/insights`, token, {
          metric: "reach",
          period: "day",
          since: s,
          until: u,
        }).catch(() => ({ data: [] })),
        igGet(`${igId}/insights`, token, {
          metric: "total_interactions",
          period: "day",
          since: s,
          until: u,
          metric_type: "total_value",
        }).catch(() => ({ data: [] })),
        // follower_count only supported for last ~30 days; older months silently return empty
        igGet(`${igId}/insights`, token, {
          metric: "follower_count",
          period: "day",
          since: s,
          until: u,
        }).catch(() => ({ data: [] })),
      ]);

      type DailyValue = { value: number; end_time: string };
      type TotalValueEntry = { total_value?: { value: number } };

      const reachValues = (r1.data as Array<{ values?: DailyValue[] }>)?.[0]?.values ?? [];
      const alcance = reachValues.reduce((sum, v) => sum + (v.value ?? 0), 0);

      const engajamento = ((r2.data as TotalValueEntry[])?.[0]?.total_value?.value) ?? 0;

      const followValues = (r3.data as Array<{ values?: DailyValue[] }>)?.[0]?.values ?? [];
      const novosSeguidores = followValues.reduce((sum, v) => sum + (v.value ?? 0), 0);

      monthMap.set(key, { ano, mes, alcance, engajamento, novosSeguidores });
    }

    const syncedAt = new Date();
    const upserts = [...monthMap.values()].map((bucket) =>
      prisma.instagramInsightMensal.upsert({
        where: { clienteId_ano_mes: { clienteId, ano: bucket.ano, mes: bucket.mes } },
        create: {
          clienteId,
          ano: bucket.ano,
          mes: bucket.mes,
          alcance: bucket.alcance,
          engajamento: bucket.engajamento,
          novosSeguidores: bucket.novosSeguidores,
          followersTotal,
          syncedAt,
        },
        update: {
          alcance: bucket.alcance,
          engajamento: bucket.engajamento,
          novosSeguidores: bucket.novosSeguidores,
          followersTotal,
          syncedAt,
        },
      }),
    );

    await Promise.all(upserts);

    return { clienteId, monthsProcessed: monthMap.size };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { clienteId, error: msg };
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
