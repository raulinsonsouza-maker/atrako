import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchKeywordMetrics } from "@/lib/googleAds/googleAdsClient";

function n(v: string | number | undefined | null): number {
  return Number(v ?? 0);
}

const MATCH_TYPE_PT: Record<string, string> = {
  BROAD: "Ampla",
  PHRASE: "Frase",
  EXACT: "Exata",
  UNSPECIFIED: "Não especificado",
  UNKNOWN: "Não especificado",
};

export interface KeywordAnalysis {
  text: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpl: number;
  ctr: number;
  avgCpc: number;
  decision: "escalar" | "otimizar" | "pausar" | "revisar" | "neutro";
}

export interface GoogleKeywordsResponse {
  keywords: KeywordAnalysis[];
  totals: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    cpl: number;
    ctr: number;
  };
  dateFrom: string;
  dateTo: string;
  error?: string;
}

function calcDecision(
  kw: { clicks: number; cost: number; conversions: number; impressions: number; ctr: number },
  avgCplAll: number
): KeywordAnalysis["decision"] {
  const { clicks, cost, conversions, impressions, ctr } = kw;
  const cpl = conversions > 0 ? cost / conversions : 0;
  const cplLimit = avgCplAll > 0 ? avgCplAll * 2 : Infinity;
  const cplAlvo = avgCplAll > 0 ? avgCplAll : Infinity;

  if (conversions > 0 && cpl <= cplAlvo) return "escalar";
  if (conversions > 0 && cpl <= cplLimit) return "otimizar";
  if (clicks >= 20 && conversions === 0) return "pausar";
  if (impressions >= 100 && ctr < 0.5) return "revisar";
  return "neutro";
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(s: string): Date | null {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;

  // Resolve period identical to other routes
  const periodo = sp.get("periodo") ?? "30";
  const diasFallback = Math.min(365, Math.max(7, parseInt(periodo, 10) || 30));
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - diasFallback);

  const dataInicioParam = sp.get("dataInicio") ?? sp.get("dateFrom");
  const dataFimParam = sp.get("dataFim") ?? sp.get("dateTo");
  if (dataInicioParam && dataFimParam) {
    const pi = parseDateOnly(dataInicioParam);
    const pf = parseDateOnly(dataFimParam);
    if (pi && pf) {
      startDate.setTime(pi.getTime());
      endDate.setTime(pf.getTime());
    }
  }

  const dateFrom = toYMD(startDate);
  const dateTo = toYMD(endDate);

  const conta = await prisma.conta.findFirst({
    where: { clienteId: id, plataforma: "GOOGLE_ADS" },
  });

  if (!conta?.accountIdPlataforma) {
    return NextResponse.json<GoogleKeywordsResponse>({
      keywords: [],
      totals: { impressions: 0, clicks: 0, cost: 0, conversions: 0, cpl: 0, ctr: 0 },
      dateFrom,
      dateTo,
      error: "Conta Google Ads não configurada para este cliente.",
    });
  }

  try {
    const rows = await fetchKeywordMetrics(
      conta.accountIdPlataforma,
      dateFrom,
      dateTo,
      { loginCustomerId: conta.googleAdsLoginCustomerId }
    );

    // Aggregate by (keyword text + match type + campaign + adgroup)
    const map = new Map<string, KeywordAnalysis>();
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const criterion = (row.ad_group_criterion ?? (r.ad_group_criterion as Record<string, unknown> | undefined));
      const kwObj = (criterion as Record<string, unknown> | undefined)?.keyword as Record<string, unknown> | undefined;
      const text = String(kwObj?.text ?? "").trim() || "(sem texto)";
      const matchRaw = String(kwObj?.match_type ?? "UNSPECIFIED");
      const matchType = MATCH_TYPE_PT[matchRaw] ?? matchRaw;
      const campaign = row.campaign as Record<string, unknown> | undefined;
      const adGroup = row.ad_group as Record<string, unknown> | undefined;
      const metrics = row.metrics as Record<string, unknown> | undefined;
      const campaignName = String(campaign?.name ?? "—");
      const adGroupName = String(adGroup?.name ?? "—");

      const impressions = n(metrics?.impressions as number | undefined);
      const clicks = n(metrics?.clicks as number | undefined);
      const costMicros = n(metrics?.cost_micros as number | undefined);
      const cost = costMicros / 1_000_000;
      const conversions = n(metrics?.conversions as number | undefined) || n(metrics?.all_conversions as number | undefined);
      const ctr = n(metrics?.ctr as number | undefined) * 100;
      const avgCpcMicros = n(metrics?.average_cpc as number | undefined);
      const avgCpc = avgCpcMicros / 1_000_000;

      const key = `${text}||${matchRaw}||${campaignName}||${adGroupName}`;
      const existing = map.get(key);
      if (existing) {
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.cost += cost;
        existing.conversions += conversions;
      } else {
        map.set(key, {
          text,
          matchType,
          campaignName,
          adGroupName,
          impressions,
          clicks,
          cost,
          conversions,
          cpl: 0,
          ctr,
          avgCpc,
          decision: "neutro",
        });
      }
    }

    const keywords = Array.from(map.values());

    // Compute totals
    const totClicks = keywords.reduce((s, k) => s + k.clicks, 0);
    const totImpressions = keywords.reduce((s, k) => s + k.impressions, 0);
    const totCost = keywords.reduce((s, k) => s + k.cost, 0);
    const totConversions = keywords.reduce((s, k) => s + k.conversions, 0);
    const avgCplAll = totConversions > 0 ? totCost / totConversions : 0;

    // Compute CPL and decisions
    for (const kw of keywords) {
      kw.cpl = kw.conversions > 0 ? kw.cost / kw.conversions : 0;
      kw.ctr = kw.clicks > 0 && kw.impressions > 0 ? (kw.clicks / kw.impressions) * 100 : kw.ctr;
      kw.decision = calcDecision(kw, avgCplAll);
    }

    // Sort: with conversions first, then by impressions
    keywords.sort((a, b) => {
      if (b.conversions !== a.conversions) return b.conversions - a.conversions;
      return b.impressions - a.impressions;
    });

    return NextResponse.json<GoogleKeywordsResponse>({
      keywords,
      totals: {
        impressions: totImpressions,
        clicks: totClicks,
        cost: totCost,
        conversions: totConversions,
        cpl: avgCplAll,
        ctr: totClicks > 0 && totImpressions > 0 ? (totClicks / totImpressions) * 100 : 0,
      },
      dateFrom,
      dateTo,
    });
  } catch (e) {
    return NextResponse.json<GoogleKeywordsResponse>({
      keywords: [],
      totals: { impressions: 0, clicks: 0, cost: 0, conversions: 0, cpl: 0, ctr: 0 },
      dateFrom,
      dateTo,
      error: e instanceof Error ? e.message : "Erro ao buscar palavras-chave.",
    });
  }
}
