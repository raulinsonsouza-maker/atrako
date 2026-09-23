import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { discoverInstagramId } from "@/lib/sync/discoverInstagramId";

const GRAPH = "https://graph.facebook.com/v19.0";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clienteId } = await params;
  const sp = new URL(req.url).searchParams;
  const dataInicio = sp.get("dataInicio");
  const dataFim = sp.get("dataFim");
  const granularity = sp.get("granularity") ?? "mensal"; // "mensal" | "semanal"

  const igId = await discoverInstagramId(clienteId);

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

  type MonthRow = { mes: string; label: string; alcance: number; engajamento: number; novosSeguidores: number; followersTotal: number };
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
    }));
    const latest = dbInsights[dbInsights.length - 1];
    followersTotal = latest.followersTotal;
  } else {
    // Live fallback
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

        const [r1, r2, r3] = await Promise.all([
          igGet(`${igId}/insights`, token, { metric: "reach", period: "day", since: s, until: u }).catch(() => ({ data: [] })),
          igGet(`${igId}/insights`, token, { metric: "total_interactions", period: "day", since: s, until: u, metric_type: "total_value" }).catch(() => ({ data: [] })),
          igGet(`${igId}/insights`, token, { metric: "follower_count", period: "day", since: s, until: u }).catch(() => ({ data: [] })),
        ]);

        const alcance = ((r1.data as Array<{ values?: DailyValue[] }>)?.[0]?.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
        const engajamento = ((r2.data as TotalValueEntry[])?.[0]?.total_value?.value) ?? 0;
        const novosSeguidores = ((r3.data as Array<{ values?: DailyValue[] }>)?.[0]?.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
        monthMap.set(k, { mes: k, label: monthLabel(ano, mes), alcance, engajamento, novosSeguidores, followersTotal: 0 });
      }
      monthly = [...monthMap.values()].sort((a, b) => a.mes.localeCompare(b.mes));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao consultar Instagram API";
      return NextResponse.json({ configured: true, error: msg }, { status: 500 });
    }
  }

  const alcanceTotal = monthly.reduce((s, m) => s + m.alcance, 0);
  const engajamentoTotal = monthly.reduce((s, m) => s + m.engajamento, 0);
  const novosSeguidoresTotal = monthly.reduce((s, m) => s + m.novosSeguidores, 0);
  const taxaEngajamento = alcanceTotal > 0 ? (engajamentoTotal / alcanceTotal) * 100 : 0;

  // --- Weekly data (semanal granularity) — live fetch ---
  type WeekRow = { label: string; semana: string; gains: number; followersTotal: number };
  let weeklyData: WeekRow[] | null = null;

  if (granularity === "semanal") {
    const weeklyCacheKey = `${clienteId}|${startKey}|${endKey}`;
    const cachedWeekly = weeklyCache.get(weeklyCacheKey);

    if (cachedWeekly && Date.now() - cachedWeekly.ts < WEEKLY_CACHE_TTL) {
      weeklyData = cachedWeekly.data as WeekRow[];
    } else {
      const creds = await resolveMetaCredentials(clienteId);
      if (creds?.token) {
        try {
          // Only fetch up to 90 days back
          const daysDiff = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
          const effectiveStart = daysDiff > 90
            ? new Date(rangeEnd.getTime() - 90 * 24 * 60 * 60 * 1000)
            : rangeStart;
          effectiveStart.setHours(0, 0, 0, 0);

          // Get base followers from DB (most recent snapshot before rangeStart)
          const baseSnapshot = allDbInsights.filter((r) => {
            const k = `${r.ano}-${String(r.mes).padStart(2, "0")}`;
            return k < startKey;
          }).pop();
          let baseFol = baseSnapshot?.followersTotal ?? followersTotal;

          // Fetch daily gains in 28-day windows
          type DayGain = { date: string; gain: number };
          const dailyGains: DayGain[] = [];
          let cursor = new Date(effectiveStart);

          while (cursor < rangeEnd) {
            const until = new Date(Math.min(cursor.getTime() + 28 * 24 * 60 * 60 * 1000, rangeEnd.getTime()));
            const raw = await igGet(`${igId}/insights`, creds.token, {
              metric: "follower_count",
              period: "day",
              since: String(toUnix(cursor)),
              until: String(toUnix(until)),
            }).catch(() => ({ data: [] }));

            const values = (raw?.data as Array<{ values?: Array<{ value: number; end_time: string }> }>)?.[0]?.values ?? [];
            for (const v of values) {
              const date = v.end_time.slice(0, 10);
              if (date >= effectiveStart.toISOString().slice(0, 10)) {
                dailyGains.push({ date, gain: v.value ?? 0 });
              }
            }
            cursor = until;
          }

          // Aggregate into calendar weeks (Mon–Sun)
          const weekMap = new Map<string, { gains: number; endDate: string }>();
          let runningTotal = baseFol;

          for (const day of dailyGains.sort((a, b) => a.date.localeCompare(b.date))) {
            runningTotal += day.gain;
            const d = new Date(day.date + "T12:00:00");
            const dow = d.getDay();
            const monday = new Date(d);
            monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
            const wk = monday.toISOString().slice(0, 10);
            const ex = weekMap.get(wk) ?? { gains: 0, endDate: day.date };
            weekMap.set(wk, { gains: ex.gains + day.gain, endDate: day.date });
          }

          // Build week rows with cumulative followers
          runningTotal = baseFol;
          weeklyData = [...weekMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([wk, v]) => {
              runningTotal += v.gains;
              const d = new Date(wk + "T12:00:00");
              const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
              return { semana: wk, label, gains: v.gains, followersTotal: runningTotal };
            });

          weeklyCache.set(weeklyCacheKey, { data: weeklyData, ts: Date.now() });
        } catch {
          weeklyData = null;
        }
      }
    }
  }

  // --- Top posts: top 10 by REACH, fetched live ---
  const mediaStart = dataInicio ?? since12.toISOString().slice(0, 10);
  const mediaEnd = dataFim ?? now.toISOString().slice(0, 10);
  const postCacheKey = `${clienteId}|${mediaStart}|${mediaEnd}`;
  const cachedPosts = postCache.get(postCacheKey);

  type PostRow = {
    id: string; caption: string; thumbnailUrl: string | null; mediaUrl: string | null;
    mediaType: string; timestamp: string; alcance: number; curtidas: number;
    comentarios: number; salvos: number; compartilhamentos: number; taxaEngajamento: number;
  };
  let topPosts: PostRow[] = [];
  let profileNome = "";

  if (cachedPosts && Date.now() - cachedPosts.ts < POST_CACHE_TTL) {
    const cached = cachedPosts.data as { topPosts: PostRow[]; nome: string };
    topPosts = cached.topPosts;
    profileNome = cached.nome;
  } else {
    const creds = await resolveMetaCredentials(clienteId);
    if (creds?.token) {
      const token = creds.token;
      try {
        const [profileRaw, mediaRaw] = await Promise.all([
          igGet(`${igId}`, token, { fields: "followers_count,name" }),
          igGet(`${igId}/media`, token, {
            fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count",
            limit: "50",
          }),
        ]);

        profileNome = profileRaw.name ?? "";
        if (profileRaw.followers_count && !followersTotal) {
          followersTotal = profileRaw.followers_count;
        }

        const allMedia = (mediaRaw.data ?? []) as Array<{
          id: string; caption?: string; media_type: string;
          media_url?: string; thumbnail_url?: string; timestamp: string;
          like_count: number; comments_count: number;
        }>;

        const filtered = allMedia.filter((m) => {
          const t = m.timestamp.slice(0, 10);
          return t >= mediaStart && t <= mediaEnd;
        });

        // Fetch reach for all candidates to sort by alcance
        const candidates = filtered.slice(0, 30); // limit API calls
        const insightResults = await Promise.allSettled(
          candidates.map((m) => igGet(`${m.id}/insights`, token, { metric: "reach,saved,shares" })),
        );

        const withReach = candidates.map((m, i) => {
          const insightData = insightResults[i].status === "fulfilled"
            ? (insightResults[i] as PromiseFulfilledResult<{ data?: Array<{ name: string; values?: Array<{ value: number }> }> }>).value.data ?? []
            : [];
          const getMetric = (name: string) =>
            insightData.find((d: { name: string }) => d.name === name)?.values?.[0]?.value ?? 0;
          return { m, alcance: getMetric("reach"), salvos: getMetric("saved"), compartilhamentos: getMetric("shares") };
        });

        // Sort by ALCANCE (reach) — top 10
        const top10 = withReach.sort((a, b) => b.alcance - a.alcance).slice(0, 10);

        topPosts = top10.map(({ m, alcance, salvos, compartilhamentos }) => {
          const curtidas = m.like_count;
          const comentarios = m.comments_count;
          const totalInteracoes = curtidas + comentarios + salvos + compartilhamentos;
          const taxaPost = alcance > 0 ? (totalInteracoes / alcance) * 100 : 0;
          const thumbnailUrl = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
          return {
            id: m.id,
            caption: m.caption ?? "",
            thumbnailUrl: thumbnailUrl ?? null,
            mediaUrl: m.media_url ?? null,
            mediaType: m.media_type,
            timestamp: m.timestamp,
            alcance,
            curtidas,
            comentarios,
            salvos,
            compartilhamentos,
            taxaEngajamento: Math.round(taxaPost * 100) / 100,
          };
        });

        postCache.set(postCacheKey, { data: { topPosts, nome: profileNome }, ts: Date.now() });
      } catch {
        // Top posts unavailable
      }
    }
  }

  // Curtidas + Comentários totals from top posts
  const curtidasTotal = topPosts.reduce((s, p) => s + p.curtidas, 0);
  const comentariosTotal = topPosts.reduce((s, p) => s + p.comentarios, 0);

  // --- Demographics: audience_gender_age + audience_city ---
  type Demographics = {
    genero: { F: number; M: number; U: number };
    faixaEtaria: Record<string, number>;
    cidades: Array<{ cidade: string; seguidores: number }>;
  };
  let demographics: Demographics | null = null;

  const demoCacheKey = clienteId;
  const cachedDemo = demoCache.get(demoCacheKey);
  if (cachedDemo && Date.now() - cachedDemo.ts < DEMO_CACHE_TTL) {
    demographics = cachedDemo.data as Demographics;
  } else {
    const creds = await resolveMetaCredentials(clienteId);
    if (creds?.token) {
      try {
        const [genderAgeRaw, cityRaw] = await Promise.all([
          igGet(`${igId}/insights`, creds.token, { metric: "audience_gender_age", period: "lifetime" }).catch(() => null),
          igGet(`${igId}/insights`, creds.token, { metric: "audience_city", period: "lifetime" }).catch(() => null),
        ]);

        if (genderAgeRaw) {
          const genderAgeValue = (genderAgeRaw?.data as Array<{ values?: Array<{ value: Record<string, number> }> }>)?.[0]?.values?.[0]?.value ?? {};
          const genero = { F: 0, M: 0, U: 0 };
          const faixaEtaria: Record<string, number> = {};

          for (const [key, count] of Object.entries(genderAgeValue)) {
            const [gender, age] = key.split(".");
            if (gender in genero) genero[gender as keyof typeof genero] += count;
            faixaEtaria[age] = (faixaEtaria[age] ?? 0) + count;
          }

          const cityValue = (cityRaw?.data as Array<{ values?: Array<{ value: Record<string, number> }> }>)?.[0]?.values?.[0]?.value ?? {};
          const cidades = Object.entries(cityValue)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([cidade, seguidores]) => ({ cidade, seguidores }));

          demographics = { genero, faixaEtaria, cidades };
          demoCache.set(demoCacheKey, { data: demographics, ts: Date.now() });
        }
      } catch {
        // Demographics unavailable — not critical
      }
    }
  }

  // Period label
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  const periodoLabel = `${fmtDate(rangeStart)} a ${fmtDate(rangeEnd)}`;

  return NextResponse.json({
    configured: true,
    source: dbInsights.length >= dbThreshold ? "db" : "live",
    profile: { nome: profileNome, followersTotal },
    period: {
      alcanceTotal,
      engajamentoTotal,
      novosSeguidores: novosSeguidoresTotal,
      taxaEngajamento: Math.round(taxaEngajamento * 100) / 100,
      curtidasTotal,
      comentariosTotal,
    },
    periodoLabel,
    monthly,
    weeklyData,
    topPosts,
    demographics,
  });
}
