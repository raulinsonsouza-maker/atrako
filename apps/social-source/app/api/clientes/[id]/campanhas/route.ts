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
  const conjunto = sp.get("conjunto") ?? null;
  const canal = sp.get("canal") ?? "geral";
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

  const canalFilter = canal === "geral" ? undefined : canal.toUpperCase();

  if (nivel === "campanhas") {
    // Group FatoMidiaDiario by campaignName with full metrics
    const fatos = await prisma.fatoMidiaDiario.findMany({
      where: {
        clienteId: id,
        data: { gte: dataInicio, lte: dataFim },
        ...(canalFilter ? { canal: canalFilter } : {}),
        NOT: { campaignName: "" },
      },
    });

    const byCampanha = new Map<string, {
      investimento: number;
      impressoes: number;
      cliques: number;
      leads: number;
      purchases: number;
      faturamento: number;
      conversas: number;
      profileVisits: number;
      diasAtivos: Set<string>;
    }>();

    for (const fato of fatos) {
      const nome = fato.campaignName.trim() || "Campanha sem nome";
      const dateKey = fato.data.toISOString().slice(0, 10);
      const existing = byCampanha.get(nome);
      if (existing) {
        existing.investimento += Number(fato.investimento);
        existing.impressoes += fato.impressoes;
        existing.cliques += fato.cliques;
        existing.leads += fato.leads;
        existing.purchases += fato.purchases;
        existing.faturamento += Number(fato.websitePurchasesConversionValue);
        existing.conversas += fato.messagingConversationsStarted ?? 0;
        existing.profileVisits += (fato as { profileVisits?: number }).profileVisits ?? 0;
        if (Number(fato.investimento) > 0) existing.diasAtivos.add(dateKey);
      } else {
        byCampanha.set(nome, {
          investimento: Number(fato.investimento),
          impressoes: fato.impressoes,
          cliques: fato.cliques,
          leads: fato.leads,
          purchases: fato.purchases,
          faturamento: Number(fato.websitePurchasesConversionValue),
          conversas: fato.messagingConversationsStarted ?? 0,
          profileVisits: (fato as { profileVisits?: number }).profileVisits ?? 0,
          diasAtivos: Number(fato.investimento) > 0 ? new Set([dateKey]) : new Set(),
        });
      }
    }

    // Derive campaign status from the most recent MetaAdsCriativo effectiveStatus per ad.
    // A campaign is ATIVA if any of its ads is currently ACTIVE (in its latest record).
    const allCreatives = await prisma.metaAdsCriativo.findMany({
      where: { clienteId: id },
      select: { campaignName: true, effectiveStatus: true, data: true, adId: true },
      orderBy: { data: "desc" },
    });

    // Step 1: keep only the most recent record per adId (sync writes one row per day per ad).
    const latestPerAd = new Map<string, typeof allCreatives[0]>();
    for (const c of allCreatives) {
      const prev = latestPerAd.get(c.adId);
      if (!prev || c.data > prev.data) latestPerAd.set(c.adId, c);
    }

    // Step 2: derive campaign status from the deduped latest-per-ad records.
    const campaignStatusMap = new Map<string, string>();
    for (const c of latestPerAd.values()) {
      const name = (c.campaignName ?? "").trim();
      if (!name) continue;
      if (c.effectiveStatus === "ACTIVE") {
        campaignStatusMap.set(name, "ATIVA");
      } else if (!campaignStatusMap.has(name)) {
        campaignStatusMap.set(name, "PAUSADA");
      }
    }

    // Derive result type and primary metric per campaign
    type ResultType = "vendas" | "leads" | "conversas" | "visitas" | "alcance";
    function deriveResultType(v: { purchases: number; leads: number; conversas: number; profileVisits: number }, nome: string): ResultType {
      if (v.purchases > 0) return "vendas";
      // Dominant metric wins between leads vs conversas: WhatsApp messaging campaigns
      // often register a handful of incidental "leads" alongside hundreds of real conversas
      // (and vice-versa for lead-form campaigns). Pick whichever is materially bigger.
      if (v.leads > 0 && v.leads >= v.conversas) return "leads";
      // Same rule for profileVisits vs conversas (Instagram engagement campaigns).
      if (v.profileVisits > v.conversas) return "visitas";
      if (v.conversas > 0) return "conversas";
      if (v.leads > 0) return "leads";
      if (v.profileVisits > 0) return "visitas";
      const n = nome.toLowerCase();
      if (/whatsapp|mensagem|message/.test(n)) return "conversas";
      if (/instagram|perfil|engajamento|engagement|alcance|reach|awareness/.test(n)) return "alcance";
      return "alcance";
    }

    const campanhas = Array.from(byCampanha.entries())
      .map(([nome, v]) => {
        const resultType = deriveResultType(v, nome);
        const resultados = resultType === "vendas" ? v.purchases : resultType === "leads" ? v.leads : resultType === "conversas" ? v.conversas : resultType === "visitas" ? v.profileVisits : null;
        const custoResultado = resultados && resultados > 0 ? v.investimento / resultados : null;
        return {
          nome,
          status: campaignStatusMap.get(nome) ?? null,
          diasAtivos: v.diasAtivos.size,
          investimento: v.investimento,
          impressoes: v.impressoes,
          cliques: v.cliques,
          leads: v.leads,
          purchases: v.purchases,
          faturamento: v.faturamento,
          conversas: v.conversas,
          profileVisits: v.profileVisits,
          resultType,
          resultados,
          custoResultado,
          cpl: v.leads > 0 ? v.investimento / v.leads : null,
          cpa: v.purchases > 0 ? v.investimento / v.purchases : null,
          ticketMedio: v.purchases > 0 ? v.faturamento / v.purchases : null,
          roas: v.investimento > 0 && v.faturamento > 0 ? v.faturamento / v.investimento : null,
          ctr: v.impressoes > 0 ? (v.cliques / v.impressoes) * 100 : null,
        };
      })
      .filter(c => c.investimento > 1)
      .sort((a, b) => b.investimento - a.investimento);

    return NextResponse.json({ nivel: "campanhas", campanhas });
  }

  if (nivel === "conjuntos" && campanha) {
    // Sync grava uma linha por (adId, dia). Filtramos por data e SOMAMOS
    // todos os dias dentro do período selecionado, mantendo consistência
    // com a agregação a nível de campanha (que também filtra por data).
    const criativos = await prisma.metaAdsCriativo.findMany({
      where: {
        clienteId: id,
        campaignName: campanha,
        data: { gte: dataInicio, lte: dataFim },
      },
      orderBy: { data: "desc" },
    });

    // Conjunto de adIds vistos no período (para contar ads únicos por conjunto).
    const adIdsByConjunto = new Map<string, Set<string>>();

    const byConjunto = new Map<string, {
      adsetId: string;
      adsetName: string;
      spend: number;
      impressions: number;
      clicks: number;
      leads: number;
      purchases: number;
      faturamento: number;
      conversas: number;
      adCount: number;
    }>();

    for (const c of criativos) {
      const key = c.adsetId ?? "sem-conjunto";
      let adIds = adIdsByConjunto.get(key);
      if (!adIds) {
        adIds = new Set();
        adIdsByConjunto.set(key, adIds);
      }
      adIds.add(c.adId);

      const existing = byConjunto.get(key);
      if (existing) {
        existing.spend += Number(c.spend);
        existing.impressions += c.impressions;
        existing.clicks += c.clicks;
        existing.leads += c.leads;
        existing.purchases += c.purchases;
        existing.faturamento += Number(c.websitePurchasesConversionValue);
        existing.conversas += c.messagingConversationsStarted ?? 0;
      } else {
        byConjunto.set(key, {
          adsetId: c.adsetId ?? "",
          adsetName: c.adsetName ?? "Conjunto sem nome",
          spend: Number(c.spend),
          impressions: c.impressions,
          clicks: c.clicks,
          leads: c.leads,
          purchases: c.purchases,
          faturamento: Number(c.websitePurchasesConversionValue),
          conversas: c.messagingConversationsStarted ?? 0,
          adCount: 0,
        });
      }
    }
    // adCount = total de ads únicos no conjunto dentro do período
    for (const [key, adIds] of adIdsByConjunto.entries()) {
      const v = byConjunto.get(key);
      if (v) v.adCount = adIds.size;
    }

    const conjuntos = Array.from(byConjunto.values())
      .map((v) => ({
        ...v,
        ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null,
        cpc: v.clicks > 0 ? v.spend / v.clicks : null,
        cpl: v.leads > 0 ? v.spend / v.leads : null,
        cpa: v.purchases > 0 ? v.spend / v.purchases : null,
        custoConversa: v.conversas > 0 ? v.spend / v.conversas : null,
        ticketMedio: v.purchases > 0 ? v.faturamento / v.purchases : null,
        roas: v.spend > 0 && v.faturamento > 0 ? v.faturamento / v.spend : null,
      }))
      .sort((a, b) => b.spend - a.spend);

    return NextResponse.json({ nivel: "conjuntos", campanha, conjuntos });
  }

  if (nivel === "criativos" && campanha && conjunto) {
    // Sync grava uma linha por (adId, dia). Filtramos pelo período da UI
    // e SOMAMOS as linhas diárias por adId. Metadados do criativo (nome,
    // imagem, status etc.) vêm do registro mais recente dentro do período.
    const rows = await prisma.metaAdsCriativo.findMany({
      where: {
        clienteId: id,
        campaignName: campanha,
        adsetId: conjunto,
        data: { gte: dataInicio, lte: dataFim },
      },
      orderBy: [{ data: "desc" }],
    });

    // Map by adId — soma incremental por dia
    const byAd = new Map<string, {
      adId: string; adName: string; mediaType: string;
      imageUrl: string | null; videoId: string | null;
      videoSourceUrl: string | null; videoPictureUrl: string | null;
      videoEmbedHtml: string | null; body: string | null; title: string | null;
      effectiveStatus: string | null; spend: number; impressions: number; clicks: number;
      leads: number; purchases: number; faturamento: number; conversas: number;
      daysActive: number;
      _latestData: Date;
    }>();

    for (const r of rows) {
      const existing = byAd.get(r.adId);
      if (existing) {
        existing.spend += Number(r.spend);
        existing.impressions += r.impressions;
        existing.clicks += r.clicks;
        existing.leads += r.leads;
        existing.purchases += r.purchases;
        existing.faturamento += Number(r.websitePurchasesConversionValue);
        existing.conversas += r.messagingConversationsStarted ?? 0;
        if (Number(r.spend) > 0 || r.impressions > 0) existing.daysActive += 1;
        // metadados ficam com o registro mais recente
        if (r.data > existing._latestData) {
          existing._latestData = r.data;
          existing.adName = r.adName;
          existing.mediaType = r.mediaType;
          existing.imageUrl = r.imageUrlFull ?? r.imageUrl ?? null;
          existing.videoId = r.videoId ?? null;
          existing.videoSourceUrl = r.videoSourceUrl ?? null;
          existing.videoPictureUrl = r.videoPictureUrl ?? null;
          existing.videoEmbedHtml = r.videoEmbedHtml ?? null;
          existing.body = r.body ?? null;
          existing.title = r.title ?? null;
          existing.effectiveStatus = r.effectiveStatus ?? null;
        }
      } else {
        byAd.set(r.adId, {
          adId: r.adId,
          adName: r.adName,
          mediaType: r.mediaType,
          imageUrl: r.imageUrlFull ?? r.imageUrl ?? null,
          videoId: r.videoId ?? null,
          videoSourceUrl: r.videoSourceUrl ?? null,
          videoPictureUrl: r.videoPictureUrl ?? null,
          videoEmbedHtml: r.videoEmbedHtml ?? null,
          body: r.body ?? null,
          title: r.title ?? null,
          effectiveStatus: r.effectiveStatus ?? null,
          spend: Number(r.spend),
          impressions: r.impressions,
          clicks: r.clicks,
          leads: r.leads,
          purchases: r.purchases,
          faturamento: Number(r.websitePurchasesConversionValue),
          conversas: r.messagingConversationsStarted ?? 0,
          daysActive: Number(r.spend) > 0 || r.impressions > 0 ? 1 : 0,
          _latestData: r.data,
        });
      }
    }

    const list = Array.from(byAd.values())
      .map(({ _latestData: _ignored, ...v }) => ({
        ...v,
        ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null,
        cpc: v.clicks > 0 ? v.spend / v.clicks : null,
        cpm: v.impressions > 0 ? (v.spend / v.impressions) * 1000 : null,
        cpl: v.leads > 0 ? v.spend / v.leads : null,
        cpa: v.purchases > 0 ? v.spend / v.purchases : null,
        custoConversa: v.conversas > 0 ? v.spend / v.conversas : null,
        ticketMedio: v.purchases > 0 ? v.faturamento / v.purchases : null,
        roas: v.spend > 0 && v.faturamento > 0 ? v.faturamento / v.spend : null,
      }))
      .sort((a, b) => b.spend - a.spend);

    return NextResponse.json({ nivel: "criativos", campanha, conjunto, criativos: list });
  }

  return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
}
