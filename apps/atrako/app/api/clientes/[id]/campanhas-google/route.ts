import { NextRequest, NextResponse } from "next/server";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";
import { isContaHotelPilot } from "@/lib/clientProfiles";
import { formatLocalDate, parseLocalDate, percentChange, previousPeriod } from "@/lib/hotelAnalysis";
import { isInternalAdminAuthorized } from "@/lib/internalAccess";
import { requireClienteAccess } from "@/lib/portalSession";

function parseDateOnly(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return parseLocalDate(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireClienteAccess(request, id, "public-read");
  if (access.response) return access.response;
  const sp = request.nextUrl.searchParams;
  const nivel = sp.get("nivel") ?? "campanhas";
  const campanha = sp.get("campanha") ?? null;
  const grupo = sp.get("grupo") ?? null;
  const periodo = sp.get("periodo") ?? "90";
  const dataInicioParam = sp.get("dataInicio");
  const dataFimParam = sp.get("dataFim");
  const comparePrevious = sp.get("compare") === "previous";
  if (comparePrevious && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Comparativo indisponível" }, { status: 404 });
  }

  const diasFallback = Math.min(365, Math.max(7, parseInt(periodo, 10) || 90));
  const dataFim = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasFallback);

  if (dataInicioParam && dataFimParam) {
    const parsedInicio = parseDateOnly(dataInicioParam);
    const parsedFim = parseDateOnly(dataFimParam);
    if (parsedInicio && parsedFim && parsedInicio <= parsedFim) {
      dataInicio.setTime(parsedInicio.getTime());
      dataFim.setTime(parsedFim.getTime());
      dataFim.setHours(23, 59, 59, 999);
    }
  }

  const cliente = await findClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  if (comparePrevious && !isContaHotelPilot(cliente)) {
    return NextResponse.json({ error: "Comparativo indisponível" }, { status: 404 });
  }
  if (comparePrevious && !(await isInternalAdminAuthorized())) {
    return NextResponse.json({ error: "Acesso administrativo necessário" }, { status: 401 });
  }

  // ── Level 1: Campanhas ──────────────────────────────────────────────────────
  if (nivel === "campanhas") {
    const rows = await prisma.googleAdsCampanha.findMany({
      where: {
        clienteId: id,
        data: { gte: dataInicio, lte: dataFim },
      },
    });
    const comparison = previousPeriod(dataInicio, dataFim, sp.get("comparisonPreset"));
    const previousStart = comparison.start;
    const previousEnd = new Date(comparison.end); previousEnd.setHours(23, 59, 59, 999);
    const previousRows = comparePrevious ? await prisma.googleAdsCampanha.findMany({
      where: { clienteId: id, data: { gte: previousStart, lte: previousEnd } },
    }) : [];
    const previousByCamp = new Map<string, { nome: string; investimento: number; conversoes: number; conversaoValor: number }>();
    for (const row of previousRows) {
      const key = comparePrevious && row.campaignId ? row.campaignId : row.campaignName;
      const value = previousByCamp.get(key) ?? { nome: row.campaignName, investimento: 0, conversoes: 0, conversaoValor: 0 };
      value.investimento += Number(row.custoMicros) / 1_000_000;
      value.conversoes += row.conversoes;
      value.conversaoValor += Number(row.conversaoValorMicros) / 1_000_000;
      previousByCamp.set(key, value);
    }

    const byCamp = new Map<string, {
      nome: string;
      campaignId: string;
      campaignStatus: string | null;
      campaignType: string | null;
      investimento: number;
      impressoes: number;
      cliques: number;
      conversoes: number;
      conversaoValor: number;
    }>();

    for (const r of rows) {
      const nome = r.campaignName;
      // Preserve legacy name aggregation except while the pilot comparison is active.
      const campaignKey = comparePrevious && r.campaignId ? r.campaignId : nome;
      const ex = byCamp.get(campaignKey);
      if (ex) {
        ex.investimento += Number(r.custoMicros) / 1_000_000;
        ex.impressoes += r.impressoes;
        ex.cliques += r.cliques;
        ex.conversoes += r.conversoes;
        ex.conversaoValor += Number(r.conversaoValorMicros) / 1_000_000;
        if (r.campaignStatus) ex.campaignStatus = r.campaignStatus;
        if (r.campaignType) ex.campaignType = r.campaignType;
      } else {
        byCamp.set(campaignKey, {
          nome,
          campaignId: r.campaignId,
          campaignStatus: r.campaignStatus ?? null,
          campaignType: r.campaignType ?? null,
          investimento: Number(r.custoMicros) / 1_000_000,
          impressoes: r.impressoes,
          cliques: r.cliques,
          conversoes: r.conversoes,
          conversaoValor: Number(r.conversaoValorMicros) / 1_000_000,
        });
      }
    }

    const campanhas = Array.from(byCamp.entries())
      .map(([campaignKey, v]) => ({
        nome: v.nome,
        campaignId: v.campaignId,
        campaignStatus: v.campaignStatus,
        campaignType: v.campaignType,
        investimento: v.investimento,
        impressoes: v.impressoes,
        cliques: v.cliques,
        conversoes: v.conversoes,
        conversaoValor: v.conversaoValor,
        ctr: v.impressoes > 0 ? (v.cliques / v.impressoes) * 100 : null,
        cpc: v.cliques > 0 ? v.investimento / v.cliques : null,
        custoConversao: v.conversoes > 0 ? v.investimento / v.conversoes : null,
        roas: v.investimento > 0 && v.conversaoValor > 0 ? v.conversaoValor / v.investimento : null,
        ...(comparePrevious ? {
          comparison: {
            state: previousByCamp.has(campaignKey) ? "continuing" : "new",
            investimento: percentChange(v.investimento, previousByCamp.get(campaignKey)?.investimento ?? 0),
            conversoes: percentChange(v.conversoes, previousByCamp.get(campaignKey)?.conversoes ?? 0),
            conversaoValor: percentChange(v.conversaoValor, previousByCamp.get(campaignKey)?.conversaoValor ?? 0),
          },
        } : {}),
      }))
      .filter(c => c.investimento > 1)
      .sort((a, b) => b.investimento - a.investimento);

    const stoppedCampaigns = comparePrevious ? Array.from(previousByCamp.entries()).filter(([key]) => !byCamp.has(key)).map(([, p]) => ({
      nome: p.nome, campaignId: null, campaignStatus: "PAUSED", campaignType: null, investimento: 0, impressoes: 0, cliques: 0,
      conversoes: 0, conversaoValor: 0, ctr: null, cpc: null, custoConversao: null, roas: null,
      comparison: { state: "stopped", investimento: -100, conversoes: -100, conversaoValor: -100 },
    })) : [];
    return NextResponse.json({ nivel: "campanhas", campanhas: [...campanhas, ...stoppedCampaigns], ...(comparePrevious ? { comparisonPeriod: { start: formatLocalDate(previousStart), end: formatLocalDate(comparison.end) } } : {}) });
  }

  // ── Level 2: Grupos de anúncios ────────────────────────────────────────────
  if (nivel === "grupos" && campanha) {
    const rows = await prisma.googleAdsCriativo.findMany({
      where: {
        clienteId: id,
        data: { gte: dataInicio, lte: dataFim },
        campaignName: campanha,
      },
    });

    const byGrupo = new Map<string, {
      adGroupId: string | null;
      investimento: number;
      impressoes: number;
      cliques: number;
      conversoes: number;
      adCount: Set<string>;
    }>();

    for (const r of rows) {
      const nome = r.adGroupName ?? "Grupo sem nome";
      const ex = byGrupo.get(nome);
      if (ex) {
        ex.investimento += Number(r.custoMicros) / 1_000_000;
        ex.impressoes += r.impressoes;
        ex.cliques += r.cliques;
        ex.conversoes += r.conversoes;
        ex.adCount.add(r.adResourceName);
      } else {
        const ads = new Set<string>();
        ads.add(r.adResourceName);
        byGrupo.set(nome, {
          adGroupId: r.adGroupId,
          investimento: Number(r.custoMicros) / 1_000_000,
          impressoes: r.impressoes,
          cliques: r.cliques,
          conversoes: r.conversoes,
          adCount: ads,
        });
      }
    }

    const grupos = Array.from(byGrupo.entries())
      .map(([nome, v]) => ({
        nome,
        adGroupId: v.adGroupId,
        investimento: v.investimento,
        impressoes: v.impressoes,
        cliques: v.cliques,
        conversoes: v.conversoes,
        adCount: v.adCount.size,
        ctr: v.impressoes > 0 ? (v.cliques / v.impressoes) * 100 : null,
        cpc: v.cliques > 0 ? v.investimento / v.cliques : null,
        custoConversao: v.conversoes > 0 ? v.investimento / v.conversoes : null,
      }))
      .sort((a, b) => b.investimento - a.investimento);

    return NextResponse.json({ nivel: "grupos", campanha, grupos });
  }

  // ── Level 3: Anúncios ──────────────────────────────────────────────────────
  if (nivel === "anuncios" && campanha && grupo) {
    const rows = await prisma.googleAdsCriativo.findMany({
      where: {
        clienteId: id,
        data: { gte: dataInicio, lte: dataFim },
        campaignName: campanha,
        adGroupName: grupo,
      },
    });

    const byAd = new Map<string, {
      headline1: string | null;
      headline2: string | null;
      description: string | null;
      finalUrls: string | null;
      investimento: number;
      impressoes: number;
      cliques: number;
      conversoes: number;
    }>();

    for (const r of rows) {
      const ex = byAd.get(r.adResourceName);
      if (ex) {
        ex.investimento += Number(r.custoMicros) / 1_000_000;
        ex.impressoes += r.impressoes;
        ex.cliques += r.cliques;
        ex.conversoes += r.conversoes;
      } else {
        byAd.set(r.adResourceName, {
          headline1: r.headline1,
          headline2: r.headline2,
          description: r.description,
          finalUrls: r.finalUrls,
          investimento: Number(r.custoMicros) / 1_000_000,
          impressoes: r.impressoes,
          cliques: r.cliques,
          conversoes: r.conversoes,
        });
      }
    }

    const anuncios = Array.from(byAd.entries())
      .map(([adResourceName, v]) => ({
        adResourceName,
        ...v,
        ctr: v.impressoes > 0 ? (v.cliques / v.impressoes) * 100 : null,
        cpc: v.cliques > 0 ? v.investimento / v.cliques : null,
        cpm: v.impressoes > 0 ? (v.investimento / v.impressoes) * 1000 : null,
        custoConversao: v.conversoes > 0 ? v.investimento / v.conversoes : null,
      }))
      .sort((a, b) => b.investimento - a.investimento);

    return NextResponse.json({ nivel: "anuncios", campanha, grupo, anuncios });
  }

  return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
}
