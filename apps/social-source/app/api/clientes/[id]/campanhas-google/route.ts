import { NextRequest, NextResponse } from "next/server";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";

function parseDateOnly(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const nivel = sp.get("nivel") ?? "campanhas";
  const campanha = sp.get("campanha") ?? null;
  const grupo = sp.get("grupo") ?? null;
  const periodo = sp.get("periodo") ?? "90";
  const dataInicioParam = sp.get("dataInicio");
  const dataFimParam = sp.get("dataFim");

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

  // ── Level 1: Campanhas ──────────────────────────────────────────────────────
  if (nivel === "campanhas") {
    const rows = await prisma.googleAdsCampanha.findMany({
      where: {
        clienteId: id,
        data: { gte: dataInicio, lte: dataFim },
      },
    });

    const byCamp = new Map<string, {
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
      const ex = byCamp.get(nome);
      if (ex) {
        ex.investimento += Number(r.custoMicros) / 1_000_000;
        ex.impressoes += r.impressoes;
        ex.cliques += r.cliques;
        ex.conversoes += r.conversoes;
        ex.conversaoValor += Number(r.conversaoValorMicros) / 1_000_000;
        if (r.campaignStatus) ex.campaignStatus = r.campaignStatus;
        if (r.campaignType) ex.campaignType = r.campaignType;
      } else {
        byCamp.set(nome, {
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
      .map(([nome, v]) => ({
        nome,
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
      }))
      .filter(c => c.investimento > 1)
      .sort((a, b) => b.investimento - a.investimento);

    return NextResponse.json({ nivel: "campanhas", campanhas });
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
