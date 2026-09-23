import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { discoverInstagramId } from "@/lib/sync/discoverInstagramId";

const GRAPH = "https://graph.facebook.com/v22.0";

interface CacheEntry {
  data: unknown;
  ts: number;
}
const postCache = new Map<string, CacheEntry>();
const POST_CACHE_TTL = 60 * 60 * 1000; // 1h

const demoCache = new Map<string, CacheEntry>();
const DEMO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — demographics change slowly

const weeklyCache = new Map<string, CacheEntry>();
const WEEKLY_CACHE_TTL = 60 * 60 * 1000; // 1h


function toUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function monthLabel(ano: number, mes: number): string {
  const d = new Date(ano, mes - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

function monthKey(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

async function igGet(path: string, token: string, params: Record<string, string> = {}) {
  const sp = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH}/${path}?${sp}`);
  const json = await res.json();
  if (json.error) throw new Error(`IG API: ${json.error.message}`);
  return json;
}

const INSIGHTS_WINDOW_MS = 27 * 24 * 60 * 60 * 1000;

async function getTotalValueMetric(
  igId: string,
  token: string,
  metric: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<number | null> {
  let cursor = new Date(rangeStart);
  let total = 0;
  let received = false;
  let failed = false;

  while (cursor < rangeEnd) {
    const windowEnd = new Date(Math.min(cursor.getTime() + INSIGHTS_WINDOW_MS, rangeEnd.getTime()));
    try {
      const raw = await igGet(`${igId}/insights`, token, {
        metric,
        period: "day",
        since: String(toUnix(cursor)),
        until: String(toUnix(windowEnd)),
        metric_type: "total_value",
      });
      const value = (raw?.data as Array<{ total_value?: { value?: number } }>)?.[0]?.total_value?.value;
      if (typeof value === "number") {
        total += value;
        received = true;
      }
    } catch (error) {
      failed = true;
      console.warn("[social-media] Instagram insight indisponível", {
        igId,
        metric,
        since: cursor.toISOString(),
        until: windowEnd.toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    cursor = new Date(windowEnd.getTime() + 1000);
  }

  return received && !failed ? total : null;
}

// Parse online_followers response into byDay + byHour arrays
function parseOnlineFollowers(raw: unknown): { byDay: { day: string; count: number }[]; byHour: { hour: string; count: number }[] } | null {
  try {
    const data = (raw as { data?: Array<{ values?: Array<{ value: Record<string, unknown> }> }> })?.data;
    if (!data?.length) return null;
    const valueObj = data[0]?.values?.[0]?.value;
    if (!valueObj || typeof valueObj !== "object") return null;

    // The API returns a nested object: { "Mon": { "0": count, "1": count, ... }, "Tue": ... }
    // or sometimes { "0": count, "1": count } (hour only, no day breakdown)
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dayLabels: Record<string, string> = { Mon: "Seg", Tue: "Ter", Wed: "Qua", Thu: "Qui", Fri: "Sex", Sat: "Sáb", Sun: "Dom" };

    const firstValue = Object.values(valueObj)[0];
    if (firstValue !== null && typeof firstValue === "object") {
      // Nested: { day: { hour: count } }
      const byDayMap: Record<string, number> = {};
      const byHourMap: Record<string, number> = {};

      for (const [day, hours] of Object.entries(valueObj)) {
        const hoursObj = hours as Record<string, number>;
        const dayTotal = Object.values(hoursObj).reduce((s, v) => s + (Number(v) || 0), 0);
        byDayMap[day] = (byDayMap[day] ?? 0) + dayTotal;
        for (const [hour, cnt] of Object.entries(hoursObj)) {
          byHourMap[hour] = (byHourMap[hour] ?? 0) + (Number(cnt) || 0);
        }
      }

      const byDay = dayOrder
        .filter(d => byDayMap[d] !== undefined)
        .map(d => ({ day: dayLabels[d] ?? d, count: byDayMap[d] }));

      const byHour = Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}h`,
        count: byHourMap[String(h)] ?? 0,
      }));

      return { byDay, byHour };
    } else {
      // Flat: { "0": count, "1": count, ... } — hour only
      const byHour = Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}h`,
        count: Number((valueObj as Record<string, unknown>)[String(h)] ?? 0),
      }));
      return { byDay: [], byHour };
    }
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clienteId } = await params;
  const access = await requireClienteAccess(req, clienteId, "public-read");
  if (access.response) return access.response;
  const canUseLiveProvider = Boolean(access.internalUser);
  const sp = new URL(req.url).searchParams;
  const dataInicio = sp.get("dataInicio");
  const dataFim = sp.get("dataFim");
  const granularity = sp.get("granularity") ?? "semanal"; // "mensal" | "semanal" | "diario"

  // Discovery itself can call Meta. Anonymous requests may only use an
  // already-persisted account id and persisted insight snapshots.
  const configuredInstagram = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "INSTAGRAM" },
    select: { accountIdPlataforma: true },
  });
  const igId = configuredInstagram?.accountIdPlataforma
    ?? (canUseLiveProvider ? await discoverInstagramId(clienteId) : null);

  if (!igId && !canUseLiveProvider) {
    const persisted = await prisma.instagramInsightMensal.findMany({
      where: { clienteId },
      orderBy: [{ ano: "asc" }, { mes: "asc" }],
    });
    return NextResponse.json({
      configured: persisted.length > 0,
      source: "db",
      monthly: persisted.map((row) => ({
        mes: monthKey(row.ano, row.mes),
        label: monthLabel(row.ano, row.mes),
        alcance: row.alcance,
        engajamento: row.engajamento,
        novosSeguidores: row.novosSeguidores,
        followersTotal: row.followersTotal,
        impressoes: row.impressoes ?? 0,
      })),
      monthlyHistory: persisted.slice(-12).map((row) => ({
        mes: monthKey(row.ano, row.mes),
        label: monthLabel(row.ano, row.mes),
        alcance: row.alcance,
        engajamento: row.engajamento,
        novosSeguidores: row.novosSeguidores,
        followersTotal: row.followersTotal,
        impressoes: row.impressoes ?? 0,
      })),
      topPosts: [],
      demographics: null,
    });
  }
  if (!igId) {
    return NextResponse.json({ configured: false });
  }

  // --- Date range ---
  const now = new Date();
  const rangeStart = dataInicio
    ? new Date(dataInicio + "T00:00:00")
    : (() => { const d = new Date(now); d.setMonth(d.getMonth() - 12); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
  const rangeEnd = dataFim ? new Date(dataFim + "T23:59:59") : now;

  const startKey = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}`;
  const endKey   = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, "0")}`;

  // --- Monthly insights from DB (always computed) ---
  const allDbInsights = await prisma.instagramInsightMensal.findMany({
    where: { clienteId },
    orderBy: [{ ano: "asc" }, { mes: "asc" }],
  });

  const dbInsights = allDbInsights.filter((row) => {
    const k = `${row.ano}-${String(row.mes).padStart(2, "0")}`;
    return k >= startKey && k <= endKey;
  });

  const since12 = new Date(now);
  since12.setMonth(since12.getMonth() - 12);
  since12.setDate(1);
  since12.setHours(0, 0, 0, 0);

  type MonthRow = { mes: string; label: string; alcance: number; engajamento: number; novosSeguidores: number; followersTotal: number; impressoes: number; visitasPerfil?: number; perdaSeguidores?: number };
  let monthly: MonthRow[] = [];
  let followersTotal = 0;

  const dbThreshold = dataInicio || dataFim ? 1 : 3;
  if (dbInsights.length >= dbThreshold) {
    monthly = dbInsights.map((row) => ({
      mes: monthKey(row.ano, row.mes),
      label: monthLabel(row.ano, row.mes),
      alcance: row.alcance,
      engajamento: row.engajamento,
      novosSeguidores: row.novosSeguidores,
      followersTotal: row.followersTotal,
      impressoes: row.impressoes ?? 0,
    }));
    const latest = dbInsights[dbInsights.length - 1];
    followersTotal = latest.followersTotal;
  } else {
    if (!canUseLiveProvider) {
      // Anonymous reads never fall back to the provider. Return whatever
      // persisted monthly snapshot is available (possibly an empty series).
      monthly = dbInsights.map((row) => ({
        mes: monthKey(row.ano, row.mes),
        label: monthLabel(row.ano, row.mes),
        alcance: row.alcance,
        engajamento: row.engajamento,
        novosSeguidores: row.novosSeguidores,
        followersTotal: row.followersTotal,
        impressoes: row.impressoes ?? 0,
      }));
      followersTotal = dbInsights.at(-1)?.followersTotal ?? 0;
    } else {
      // Live fallback is restricted to authenticated internal/portal reads.
      const creds = await resolveMetaCredentials(clienteId);
      if (!creds?.token) {
        return NextResponse.json(
          { configured: true, error: "Sem credenciais Meta configuradas" },
          { status: 401 },
        );
      }
      const token = creds.token;
      try {
      const profileRaw = await igGet(`${igId}`, token, { fields: "followers_count,name" });
      followersTotal = (profileRaw.followers_count as number) ?? 0;

      type DailyValue = { value: number; end_time: string };
      type TotalValueEntry = { total_value?: { value: number } };
      const monthMap = new Map<string, MonthRow>();

      for (let i = 11; i >= 0; i--) {
        const since = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const until = new Date(since.getTime() + 28 * 24 * 60 * 60 * 1000);
        const s = String(toUnix(since));
        const u = String(toUnix(until));
        const ano = since.getFullYear();
        const mes = since.getMonth() + 1;
        const k = monthKey(ano, mes);

        const [r1, r2, r3, r4, r5] = await Promise.all([
          // reach with metric_type=total_value → deduplicated unique accounts (matches IG platform)
          igGet(`${igId}/insights`, token, { metric: "reach", period: "day", metric_type: "total_value", since: s, until: u }).catch(() => ({ data: [] })),
          igGet(`${igId}/insights`, token, { metric: "total_interactions", period: "day", since: s, until: u, metric_type: "total_value" }).catch(() => ({ data: [] })),
          igGet(`${igId}/insights`, token, { metric: "follower_count", period: "day", since: s, until: u }).catch(() => ({ data: [] })),
          igGet(`${igId}/insights`, token, { metric: "views", period: "day", since: s, until: u, metric_type: "total_value" }).catch(() => ({ data: [] })),
          // profile_views (v22.0): requires metric_type=total_value, returns data[0].total_value.value
          igGet(`${igId}/insights`, token, { metric: "profile_views", period: "day", since: s, until: u, metric_type: "total_value" }).catch(() => ({ data: [] })),
        ]);

        const alcance = ((r1.data as Array<{ total_value?: { value: number } }>)?.[0]?.total_value?.value) ?? 0;
        const engajamento = ((r2.data as TotalValueEntry[])?.[0]?.total_value?.value) ?? 0;
        const followerDailyValues = ((r3.data as Array<{ values?: DailyValue[] }>)?.[0]?.values ?? []);
        const novosSeguidores = followerDailyValues.reduce((s, v) => s + (v.value ?? 0), 0);
        const perdaSeguidores = followerDailyValues.reduce((s, v) => s + (v.value < 0 ? Math.abs(v.value) : 0), 0);
        const impressoes = ((r4.data as TotalValueEntry[])?.[0]?.total_value?.value) ?? 0;
        // profile_views uses total_value format (not values[] array)
        const visitasPerfil = (r5.data as Array<{ total_value?: { value: number } }>)?.[0]?.total_value?.value ?? 0;
        monthMap.set(k, { mes: k, label: monthLabel(ano, mes), alcance, engajamento, novosSeguidores, followersTotal: 0, impressoes, visitasPerfil, perdaSeguidores });
      }
      monthly = [...monthMap.values()].sort((a, b) => a.mes.localeCompare(b.mes));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao consultar Instagram API";
        return NextResponse.json({ configured: true, error: msg }, { status: 500 });
      }
    }
  }

  let alcanceTotal = monthly.reduce((s, m) => s + m.alcance, 0);
  let engajamentoTotal = monthly.reduce((s, m) => s + m.engajamento, 0);
  let novosSeguidoresTotal: number | null = monthly.reduce((s, m) => s + m.novosSeguidores, 0);
  let impressoesTotal = monthly.reduce((s, m) => s + m.impressoes, 0);
  // visitasPerfil + perdaSeguidores:
  // - Live path: already computed per-month in `monthly[]`
  // - DB path: monthly[] has undefined for these fields → need a live supplement fetch
  let visitasPerfilTotal: number | null = monthly.some((m) => m.visitasPerfil !== undefined)
    ? monthly.reduce((s, m) => s + (m.visitasPerfil ?? 0), 0)
    : null;
  let perdaSeguidoresTotal: number | null = monthly.some((m) => m.perdaSeguidores !== undefined)
    ? monthly.reduce((s, m) => s + (m.perdaSeguidores ?? 0), 0)
    : null;
  // insightsFetched: true when values came from live API (either live path or supplement)
  let insightsFetched = dbInsights.length < dbThreshold; // live path already fetched

  // ── Section split: "kpi" loads fast (DB + supplement + demo in parallel)
  //                  "posts" loads separately (slow IG insights calls)
  const section = sp.get("section") ?? "kpi";

  // mediaStart/mediaEnd needed by both paths
  const mediaStart = dataInicio ?? since12.toISOString().slice(0, 10);
  const mediaEnd = dataFim ?? now.toISOString().slice(0, 10);

  type PostRow = {
    id: string; caption: string; thumbnailUrl: string | null; mediaUrl: string | null;
    mediaType: string; timestamp: string; alcance: number; curtidas: number;
    comentarios: number; salvos: number; compartilhamentos: number; taxaEngajamento: number;
    videoViews?: number;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // POSTS-ONLY PATH — requested by the frontend in a separate, non-blocking query
  // ─────────────────────────────────────────────────────────────────────────────
  if (section === "posts") {
    if (!canUseLiveProvider) {
      // Post captions/media are not part of the anonymous aggregate contract.
      // Do not serve them from the process cache populated by an authorized
      // provider request.
      return NextResponse.json({
        configured: true,
        topPosts: [],
        profile: { nome: "", followersTotal },
        period: {
          curtidasTotal: null,
          comentariosTotal: null,
          compartilhamentosTotal: null,
          publicacoesTotal: 0,
          alcancePostsTotal: null,
          visualizacoesTotal: null,
          interacoesTotaisTotal: null,
        },
      });
    }
    const postCacheKey = `${clienteId}|${mediaStart}|${mediaEnd}`;
    const cachedPosts = postCache.get(postCacheKey);
    let topPosts: PostRow[] = [];
    let profileNomePosts = "";
    let publicacoesTotal = 0;
    let alcancePostsTotal: number | null = null;
    let visualizacoesTotal: number | null = null;
    let interacoesTotaisTotal: number | null = null;
    let curtidasTotal: number | null = null;
    let comentariosTotal: number | null = null;
    let compartilhamentosTotal: number | null = null;

    if (cachedPosts && Date.now() - cachedPosts.ts < POST_CACHE_TTL) {
      const cached = cachedPosts.data as {
        topPosts: PostRow[]; nome: string; publicacoesTotal: number;
        alcancePostsTotal?: number | null; visualizacoesTotal?: number | null;
        interacoesTotaisTotal?: number | null;
        curtidasTotal?: number | null; comentariosTotal?: number | null;
        compartilhamentosTotal?: number | null;
      };
      topPosts = cached.topPosts;
      profileNomePosts = cached.nome;
      publicacoesTotal = cached.publicacoesTotal ?? 0;
      alcancePostsTotal = cached.alcancePostsTotal ?? null;
      visualizacoesTotal = cached.visualizacoesTotal ?? null;
      interacoesTotaisTotal = cached.interacoesTotaisTotal ?? null;
      curtidasTotal = cached.curtidasTotal ?? null;
      comentariosTotal = cached.comentariosTotal ?? null;
      compartilhamentosTotal = cached.compartilhamentosTotal ?? null;
    } else {
      const creds = canUseLiveProvider ? await resolveMetaCredentials(clienteId) : null;
      if (creds?.token) {
        const token = creds.token;
        try {
          const profileRaw = await igGet(`${igId}`, token, { fields: "followers_count,name" });

          profileNomePosts = profileRaw.name ?? "";
          if (profileRaw.followers_count) followersTotal = profileRaw.followers_count;

          type MediaRow = {
            id: string; caption?: string; media_type: string; media_product_type?: string;
            media_url?: string; thumbnail_url?: string; timestamp: string;
            like_count: number; comments_count: number;
          };
          const allMedia: MediaRow[] = [];
          let after: string | undefined;
          for (let page = 0; page < 10; page++) {
            const mediaRaw = await igGet(`${igId}/media`, token, {
              fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,comments_count",
              limit: "100",
              ...(after ? { after } : {}),
            });
            const pageRows = (mediaRaw.data ?? []) as MediaRow[];
            allMedia.push(...pageRows);
            const oldestDate = pageRows.at(-1)?.timestamp?.slice(0, 10);
            after = (mediaRaw.paging as { cursors?: { after?: string } } | undefined)?.cursors?.after;
            if (!after || pageRows.length === 0 || (oldestDate && oldestDate < mediaStart)) break;
          }

          const filtered = allMedia.filter((m) => {
            const t = m.timestamp.slice(0, 10);
            return t >= mediaStart && t <= mediaEnd;
          });
          publicacoesTotal = filtered.length;

          const insightResults = await Promise.allSettled(
            filtered.map((m) => {
              const isReel = m.media_product_type === "REELS" || m.media_type === "VIDEO";
              const metrics = isReel ? "views,reach,saved,shares" : "reach,saved,shares";
              return igGet(`${m.id}/insights`, token, { metric: metrics });
            }),
          );
          const insightsComplete = insightResults.every((result) => result.status === "fulfilled");

          const withReach = filtered.map((m, i) => {
            const insightData = insightResults[i].status === "fulfilled"
              ? (insightResults[i] as PromiseFulfilledResult<{ data?: Array<{ name: string; values?: Array<{ value: number }> }> }>).value.data ?? []
              : [];
            const getMetric = (name: string) =>
              insightData.find((d: { name: string }) => d.name === name)?.values?.[0]?.value ?? 0;
            const isReel = m.media_product_type === "REELS" || m.media_type === "VIDEO";
            const reach = getMetric("reach");
            const views = getMetric("views");
            const effectiveReach = isReel ? (reach || views) : reach;
            const videoViews = isReel ? views : undefined;
            const salvos = getMetric("saved");
            const compartilhamentos = getMetric("shares");
            return { m, alcance: effectiveReach, salvos, compartilhamentos, videoViews: videoViews || undefined };
          });

          // Aggregate from ALL posts (before top-10 cut)
          alcancePostsTotal = insightsComplete
            ? withReach.reduce((s, p) => s + p.alcance, 0)
            : null;
          visualizacoesTotal = insightsComplete
            ? withReach.reduce((s, p) => s + (p.videoViews ?? 0), 0)
            : null;
          interacoesTotaisTotal = insightsComplete
            ? withReach.reduce((s, p) => {
                const curtidas = p.m.like_count ?? 0;
                const comentarios = p.m.comments_count ?? 0;
                return s + curtidas + comentarios + p.salvos + p.compartilhamentos;
              }, 0)
            : null;
          curtidasTotal = withReach.reduce((s, p) => s + (p.m.like_count ?? 0), 0);
          comentariosTotal = withReach.reduce((s, p) => s + (p.m.comments_count ?? 0), 0);
          compartilhamentosTotal = insightsComplete
            ? withReach.reduce((s, p) => s + p.compartilhamentos, 0)
            : null;

          const sorted = withReach.sort((a, b) => b.alcance - a.alcance);
          const topReels    = sorted.filter(x => x.m.media_product_type === "REELS" || x.m.media_type === "VIDEO").slice(0, 10);
          const topNonReels = sorted.filter(x => x.m.media_product_type !== "REELS" && x.m.media_type !== "VIDEO").slice(0, 10);
          const top10 = [...topReels, ...topNonReels].sort((a, b) => b.alcance - a.alcance);

          topPosts = top10.map(({ m, alcance, salvos, compartilhamentos, videoViews }) => {
            const curtidas = m.like_count;
            const comentarios = m.comments_count;
            const totalInteracoes = curtidas + comentarios + salvos + compartilhamentos;
            const taxaPost = alcance > 0 ? (totalInteracoes / alcance) * 100 : 0;
            const thumbnailUrl = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
            return {
              id: m.id, caption: m.caption ?? "",
              thumbnailUrl: thumbnailUrl ?? null, mediaUrl: m.media_url ?? null,
              mediaType: m.media_type, timestamp: m.timestamp,
              alcance, curtidas, comentarios, salvos, compartilhamentos,
              taxaEngajamento: Math.round(taxaPost * 100) / 100,
              videoViews: videoViews || undefined,
            };
          });

          postCache.set(postCacheKey, {
            data: {
              topPosts, nome: profileNomePosts, publicacoesTotal, alcancePostsTotal,
              visualizacoesTotal, interacoesTotaisTotal, curtidasTotal,
              comentariosTotal, compartilhamentosTotal,
            },
            ts: Date.now(),
          });
        } catch (error) {
          console.warn("[social-media] Publicações do Instagram indisponíveis", {
            clienteId,
            igId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return NextResponse.json({
      configured: true,
      topPosts,
      profile: { nome: profileNomePosts, followersTotal },
      period: {
        curtidasTotal, comentariosTotal, compartilhamentosTotal, publicacoesTotal,
        alcancePostsTotal, visualizacoesTotal, interacoesTotaisTotal,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // KPI PATH — supplement + weekly + demographics run in parallel for fast response
  // ─────────────────────────────────────────────────────────────────────────────

  // 12-month history for the evolution chart (independent of date filter)
  const monthlyHistory: MonthRow[] = allDbInsights.slice(-12).map((row) => ({
    mes: monthKey(row.ano, row.mes),
    label: monthLabel(row.ano, row.mes),
    alcance: row.alcance,
    engajamento: row.engajamento,
    novosSeguidores: row.novosSeguidores,
    followersTotal: row.followersTotal,
    impressoes: row.impressoes ?? 0,
  }));

  // Resolve credentials once — shared across all three parallel branches
  const kpiCreds = canUseLiveProvider ? await resolveMetaCredentials(clienteId) : null;

  type WeekRow = { label: string; semana: string; gains: number; followersTotal: number };
  type DayRow  = { label: string; date: string; gains: number; followersTotal: number };
  type Demographics = {
    genero: { F: number; M: number; U: number };
    faixaEtaria: Record<string, number>;
    cidades: Array<{ cidade: string; seguidores: number }>;
    onlineActivity?: { byDay: { day: string; count: number }[]; byHour: { hour: string; count: number }[] } | null;
  };

  const [supplementResult, weeklyResult, demographics] = await Promise.all([

    // ── 1. Supplement: period-precise KPI metrics from live IG API ───────────
    // DB stores monthly granularity — for filtered sub-month periods we need live values.
    // Also fetches reach + total_interactions so Alcance/Engajamento/Novos seguidores
    // reflect the exact date range, not the whole month.
    (async (): Promise<{
      visitasPerfil: number | null; perdaSeguidores: number | null; novosSeguidores: number | null;
      alcance: number | null; engajamento: number | null; impressoes: number | null;
      curtidas: number | null; comentarios: number | null; compartilhamentos: number | null;
      salvos: number | null; websiteClicks: number | null; fetched: boolean;
    }> => {
      const noData = { visitasPerfil: visitasPerfilTotal, perdaSeguidores: perdaSeguidoresTotal,
        novosSeguidores: null, alcance: null, engajamento: null, impressoes: null,
        curtidas: null, comentarios: null, compartilhamentos: null, salvos: null, websiteClicks: null,
        fetched: insightsFetched };
      if (!kpiCreds?.token) return noData;
      try {
        const rangeDuration = rangeEnd.getTime() - rangeStart.getTime();
        const canFetchUniqueTotals = rangeDuration <= INSIGHTS_WINDOW_MS;
        const [visitasPerfil, visualizacoes, curtidas, comentarios, compartilhamentos, alcance, engajamento] = await Promise.all([
          getTotalValueMetric(igId, kpiCreds.token, "profile_views", rangeStart, rangeEnd),
          // `impressions` was deprecated for account insights in Graph API v22.
          getTotalValueMetric(igId, kpiCreds.token, "views", rangeStart, rangeEnd),
          getTotalValueMetric(igId, kpiCreds.token, "likes", rangeStart, rangeEnd),
          getTotalValueMetric(igId, kpiCreds.token, "comments", rangeStart, rangeEnd),
          getTotalValueMetric(igId, kpiCreds.token, "shares", rangeStart, rangeEnd),
          canFetchUniqueTotals
            ? getTotalValueMetric(igId, kpiCreds.token, "reach", rangeStart, rangeEnd)
            : Promise.resolve(null),
          canFetchUniqueTotals
            ? getTotalValueMetric(igId, kpiCreds.token, "accounts_engaged", rangeStart, rangeEnd)
            : Promise.resolve(null),
        ]);
        const fetched = [
          visitasPerfil, visualizacoes, curtidas, comentarios,
          compartilhamentos, alcance, engajamento,
        ].some((value) => value !== null);
        return {
          visitasPerfil, perdaSeguidores: perdaSeguidoresTotal, novosSeguidores: null,
          alcance, engajamento,
          impressoes: visualizacoes, curtidas,
          comentarios, compartilhamentos,
          salvos: null, websiteClicks: null,
          fetched,
        };
      } catch (error) {
        console.error("[social-media] Falha ao complementar KPIs do Instagram", {
          clienteId,
          igId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { ...noData, fetched: false };
      }
    })(),

    // ── 2. Weekly / daily follower data ───────────────────────────────────────
    (async (): Promise<{ weeklyData: WeekRow[] | null; dailyData: DayRow[] | null }> => {
      if (granularity !== "semanal" && granularity !== "diario") return { weeklyData: null, dailyData: null };

      const weeklyCacheKey = `${clienteId}|${startKey}|${endKey}`;
      const cachedWeekly = weeklyCache.get(weeklyCacheKey);
      if (cachedWeekly && Date.now() - cachedWeekly.ts < WEEKLY_CACHE_TTL) {
        const cached = cachedWeekly.data as { weeklyData: WeekRow[]; dailyData: DayRow[] };
        return { weeklyData: cached.weeklyData, dailyData: cached.dailyData };
      }

      try {
        const allDiarioRows = await prisma.instagramInsightDiario.findMany({
          where: { clienteId, data: { gte: rangeStart, lte: rangeEnd } },
          orderBy: { data: "asc" },
        });

        type MergedDay = { date: string; gain: number; followersTotal: number };
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const dbFresh = allDiarioRows.length > 0 && allDiarioRows[allDiarioRows.length - 1].data >= twoDaysAgo;
        let merged: MergedDay[];

        if (dbFresh) {
          merged = allDiarioRows.map(r => ({
            date: r.data.toISOString().slice(0, 10),
            gain: r.novosSeguidores,
            followersTotal: r.followersTotal,
          }));
        } else {
          type DayGain = { date: string; gain: number };
          const liveGains: DayGain[] = [];
          if (kpiCreds?.token) {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            thirtyDaysAgo.setHours(0, 0, 0, 0);
            const liveStart = new Date(Math.max(rangeStart.getTime(), thirtyDaysAgo.getTime()));
            liveStart.setHours(0, 0, 0, 0);
            const liveStartStr = liveStart.toISOString().slice(0, 10);
            let cursor = new Date(liveStart);
            while (cursor < rangeEnd) {
              const until = new Date(Math.min(cursor.getTime() + 28 * 24 * 60 * 60 * 1000, rangeEnd.getTime()));
              const raw = await igGet(`${igId}/insights`, kpiCreds.token, {
                metric: "follower_count", period: "day",
                since: String(toUnix(cursor)), until: String(toUnix(until)),
              }).catch(() => ({ data: [] }));
              const values = (raw?.data as Array<{ values?: Array<{ value: number; end_time: string }> }>)?.[0]?.values ?? [];
              for (const v of values) {
                const date = v.end_time.slice(0, 10);
                if (date >= liveStartStr) liveGains.push({ date, gain: v.value ?? 0 });
              }
              cursor = until;
            }
          }

          const liveDateSet = new Set(liveGains.map(g => g.date));
          const olderRows: MergedDay[] = allDiarioRows
            .filter(r => !liveDateSet.has(r.data.toISOString().slice(0, 10)))
            .map(r => ({ date: r.data.toISOString().slice(0, 10), gain: r.novosSeguidores, followersTotal: r.followersTotal }));
          const sortedLive = liveGains.sort((a, b) => a.date.localeCompare(b.date));
          const totalLiveGainsSum = sortedLive.reduce((s, d) => s + d.gain, 0);
          let running = followersTotal - totalLiveGainsSum;
          const liveRows: MergedDay[] = sortedLive.map(g => {
            running += g.gain;
            return { date: g.date, gain: g.gain, followersTotal: running };
          });
          merged = [...olderRows, ...liveRows].sort((a, b) => a.date.localeCompare(b.date));
        }

        if (merged.length === 0) return { weeklyData: null, dailyData: null };

        const dd: DayRow[] = merged.map(({ date, gain, followersTotal: ft }) => {
          const d = new Date(date + "T12:00:00");
          const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          return { date, label, gains: gain, followersTotal: ft };
        });

        const weekMap = new Map<string, { gains: number; lastFt: number }>();
        for (const day of merged) {
          const d = new Date(day.date + "T12:00:00");
          const dow = d.getDay();
          const monday = new Date(d);
          monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
          const wk = monday.toISOString().slice(0, 10);
          const ex = weekMap.get(wk) ?? { gains: 0, lastFt: 0 };
          weekMap.set(wk, { gains: ex.gains + day.gain, lastFt: day.followersTotal });
        }
        const wd: WeekRow[] = [...weekMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([wk, v]) => {
            const d = new Date(wk + "T12:00:00");
            const sun = new Date(d);
            sun.setDate(d.getDate() + 6);
            const pad = (n: number) => String(n).padStart(2, "0");
            const label = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} - ${pad(sun.getDate())}/${pad(sun.getMonth() + 1)}`;
            return { semana: wk, label, gains: v.gains, followersTotal: v.lastFt };
          });

        weeklyCache.set(weeklyCacheKey, { data: { weeklyData: wd, dailyData: dd }, ts: Date.now() });
        return { weeklyData: wd, dailyData: dd };
      } catch {
        return { weeklyData: null, dailyData: null };
      }
    })(),

    // ── 3. Demographics + Online Activity ─────────────────────────────────────
    (async (): Promise<Demographics | null> => {
      const demoCacheKey = clienteId;
      const cachedDemo = demoCache.get(demoCacheKey);
      if (cachedDemo && Date.now() - cachedDemo.ts < DEMO_CACHE_TTL) return cachedDemo.data as Demographics;
      if (!kpiCreds?.token) return null;
      try {
        type DemoResult   = { dimension_values: string[]; value: number };
        type DemoBreakdown = { dimension_keys: string[]; results: DemoResult[] };
        type DemoData     = { total_value?: { breakdowns?: DemoBreakdown[] } };

        const [genderAgeRaw, cityRaw, onlineRaw] = await Promise.all([
          igGet(`${igId}/insights`, kpiCreds.token, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "age,gender", timeframe: "last_30_days" }).catch(() =>
            igGet(`${igId}/insights`, kpiCreds.token, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "age,gender" }).catch(() => null)
          ),
          igGet(`${igId}/insights`, kpiCreds.token, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "city", timeframe: "last_30_days" }).catch(() =>
            igGet(`${igId}/insights`, kpiCreds.token, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "city" }).catch(() => null)
          ),
          igGet(`${igId}/insights`, kpiCreds.token, { metric: "online_followers", period: "lifetime" }).catch(() => null),
        ]);

        if (!genderAgeRaw) return null;

        const results: DemoResult[] = ((genderAgeRaw?.data as DemoData[])?.[0]?.total_value?.breakdowns?.[0]?.results) ?? [];
        const genero = { F: 0, M: 0, U: 0 };
        const faixaEtaria: Record<string, number> = {};
        for (const r of results) {
          const [age, gender] = r.dimension_values;
          if (gender === "F") genero.F += r.value;
          else if (gender === "M") genero.M += r.value;
          else genero.U += r.value;
          if (age) faixaEtaria[age] = (faixaEtaria[age] ?? 0) + r.value;
        }
        const cityResults: DemoResult[] = ((cityRaw?.data as DemoData[])?.[0]?.total_value?.breakdowns?.[0]?.results) ?? [];
        const cidades = [...cityResults].sort((a, b) => b.value - a.value).slice(0, 10)
          .map((r) => ({ cidade: r.dimension_values[0], seguidores: r.value }));
        const onlineActivity = onlineRaw ? parseOnlineFollowers(onlineRaw) : null;
        const demo: Demographics = { genero, faixaEtaria, cidades, onlineActivity };
        demoCache.set(demoCacheKey, { data: demo, ts: Date.now() });
        return demo;
      } catch {
        return null;
      }
    })(),
  ]);

  // Unpack parallel results
  if (supplementResult.visitasPerfil !== null) visitasPerfilTotal = supplementResult.visitasPerfil;
  if (supplementResult.perdaSeguidores !== null) perdaSeguidoresTotal = supplementResult.perdaSeguidores;
  if (supplementResult.novosSeguidores !== null) {
    novosSeguidoresTotal = supplementResult.novosSeguidores;
  } else if (novosSeguidoresTotal === 0) {
    // DB has 0 AND supplement had no API data (window expired) → genuinely unknown, not zero
    novosSeguidoresTotal = null;
  }
  if (supplementResult.alcance         !== null) alcanceTotal         = supplementResult.alcance;
  if (supplementResult.engajamento     !== null) engajamentoTotal     = supplementResult.engajamento;
  if (supplementResult.impressoes      !== null) impressoesTotal      = supplementResult.impressoes;
  if (supplementResult.fetched) insightsFetched = true;
  const visualizacoesTotal = supplementResult.impressoes
    ?? (impressoesTotal > 0 ? impressoesTotal : null);
  const taxaEngajamento = alcanceTotal > 0 ? (engajamentoTotal / alcanceTotal) * 100 : 0;
  const { weeklyData, dailyData } = weeklyResult;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  const periodoLabel = `${fmtDate(rangeStart)} a ${fmtDate(rangeEnd)}`;

  return NextResponse.json({
    configured: true,
    source: dbInsights.length >= dbThreshold || !canUseLiveProvider ? "db" : "live",
    profile: { nome: "", followersTotal },
    period: {
      alcanceTotal,
      engajamentoTotal,
      novosSeguidores: novosSeguidoresTotal,
      taxaEngajamento: Math.round(taxaEngajamento * 100) / 100,
      curtidasTotal: supplementResult.curtidas,
      comentariosTotal: supplementResult.comentarios,
      compartilhamentosTotal: supplementResult.compartilhamentos,
      salvosTotal: supplementResult.salvos ?? null,
      websiteClicks: supplementResult.websiteClicks ?? null,
      impressoesTotal: visualizacoesTotal,
      visualizacoesTotal,
      publicacoesTotal: 0,
      visitasPerfil: visitasPerfilTotal,
      perdaSeguidores: perdaSeguidoresTotal,
      insightsFetched,
    },
    periodoLabel,
    monthly,
    monthlyHistory,
    weeklyData,
    dailyData,
    topPosts: [],
    demographics,
  });
}
