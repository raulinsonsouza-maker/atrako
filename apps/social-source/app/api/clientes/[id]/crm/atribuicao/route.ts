import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { getCrmFilters, buildTagFilterWhere, buildJsonStringFilterWhere } from "@/lib/crm/tagFilter";
import { buildLeadFilterWhere, buildPaidMediaWhere } from "@/lib/crm/canalFilter";

type Canal = "META" | "GOOGLE" | "ORGANICO" | "INDICACAO" | "DIRETO" | "OUTRO";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function canalFromMidia(
  midiaOriginal: string | null,
  fonte: string | null,
  enrichment?: { rdTags?: string[] | null; trafficSource?: string | null; utmSource?: string | null; utmMedium?: string | null } | null,
): Canal {
  if (midiaOriginal) {
    const m = norm(midiaOriginal);
    if (m.includes("facebook") || m.includes("meta") || m.includes("instagram") || m.includes("fb ads") || m.includes("meta ads") || /\bfb\b/.test(m)) return "META";
    if (m.includes("google") || m.includes("youtube") || m.includes("pmax") || m.includes("busca paga") || m.includes("performance max")) return "GOOGLE";
    if (m.includes("indica") || m.includes("referral") || m.includes("referencia") || m.includes("amigo") || m.includes("parceiro")) return "INDICACAO";
    if (m.includes("organic") || m.includes("organico") || m.includes("seo")) return "ORGANICO";
    if (m.includes("email") || m.includes("whatsapp")) return "DIRETO";
  }

  // Enrichment from RD Marketing (tags + traffic_source + UTMs) — used before falling back to fonte
  if (enrichment) {
    // Tags são o sinal mais confiável (ex: form_meta_arboreto_inout, lp_arboreto_inout)
    for (const tag of enrichment.rdTags ?? []) {
      const t = norm(tag);
      if (t.includes("meta") || t.includes("facebook") || t.includes("fb")) return "META";
      if (t.includes("google") || t.includes("pmax") || t.includes("gads")) return "GOOGLE";
      if (t.includes("indica")) return "INDICACAO";
    }
    // trafficSource do evento de conversão RD
    const ts = norm(enrichment.trafficSource ?? "");
    if (ts && (ts.includes("facebook") || ts.includes("social") || ts.includes("meta"))) return "META";
    if (ts && (ts.includes("google") || ts.includes("paid") || ts.includes("search"))) return "GOOGLE";
    if (ts && ts.includes("organic")) return "ORGANICO";
    if (ts && (ts.includes("direct") || ts.includes("direto"))) return "DIRETO";
    if (ts && ts.includes("email")) return "DIRETO";
    // UTM source como último sinal do enriquecimento
    const us = norm(enrichment.utmSource ?? "");
    if (us && (us.includes("facebook") || us.includes("meta") || us.includes("ig"))) return "META";
    if (us && (us.includes("google") || us.includes("youtube"))) return "GOOGLE";
    if (us && us.includes("organic")) return "ORGANICO";
    // UTM medium
    const um = norm(enrichment.utmMedium ?? "");
    if (um && (um.includes("cpc") || um.includes("pago") || um.includes("paid"))) {
      // paid + google source
      if (us.includes("google")) return "GOOGLE";
      if (us.includes("facebook") || us.includes("meta")) return "META";
    }
  }

  if (!fonte) return "OUTRO";
  const f = norm(fonte);
  if (f.includes("facebook") || f.includes("meta") || f.includes("instagram") || f.includes("fb ads") || /\bfb\b/.test(f)) return "META";
  if (f.includes("google") || f.includes("busca paga") || f.includes("youtube") || f.includes("pmax") || f.includes("performance max")) return "GOOGLE";
  if (f.includes("organic") || f.includes("organico") || f.includes("seo")) return "ORGANICO";
  if (f.includes("indica") || f.includes("referral") || f.includes("referencia") || f.includes("parceiro")) return "INDICACAO";
  if (f.includes("direto") || f.includes("direct") || f.includes("whatsapp") || f.includes("site") || f.includes("email")) return "DIRETO";
  return "OUTRO";
}

// Alert tags: leads that should probably not be in the active funnel
const ALERTA_KEYWORDS = [
  "nao quer", "sem interesse", "renda insuficiente", "contato inexistente",
  "desistencia", "invalido", "duplicado", "descartado", "nao quer imovel",
  "busca outra", "nao retorna",
];

function isAlertaTag(tagNormalized: string): boolean {
  return ALERTA_KEYWORDS.some((k) => tagNormalized.includes(k));
}

type DadosCvJson = {
  estado?: string | null;
  conversaoOriginal?: string | null;
  midiaOriginal?: string | null;
  tags?: unknown; // string, comma-separated string, or string[]
  possibilidadeVenda?: string | number | null; // CV stores as number 1–5
} | null;

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parsePv(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return (!isNaN(n) && n >= 1 && n <= 5) ? n : null;
}

type DadosMarketingJson = {
  metaAdId?: string | null;
  metaAdName?: string | null;
  metaAdsetId?: string | null;
  metaAdsetName?: string | null;
  metaCampaignId?: string | null;
  metaCampaignName?: string | null;
  metaFormId?: string | null;
  metaFormName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
} | null;

function parseDadosCv(raw: Prisma.JsonValue): DadosCvJson {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as DadosCvJson;
}

function parseDadosMarketing(raw: Prisma.JsonValue): DadosMarketingJson {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as DadosMarketingJson;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = request.nextUrl;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), 0, 1);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const filterType  = url.searchParams.get("filterType");
  const filterValue = url.searchParams.get("filterValue");
  const paidOnly = url.searchParams.get("paidOnly") === "1";

  const dateFrom = fromParam ? new Date(fromParam) : defaultFrom;
  const dateTo = toParam
    ? (() => { const d = new Date(toParam); d.setHours(23, 59, 59, 999); return d; })()
    : now;

  const config = await prisma.crmConfig.findUnique({
    where: { clienteId: id },
    select: { ativo: true, tipo: true, ultimoSyncAt: true },
  });
  if (!config?.ativo) {
    return NextResponse.json({ configured: false });
  }

  const crmFilters = await getCrmFilters(id);
  const { tagFilter, conversaoOriginalFilter, conversaoUltimoFilter, midiaFilter, origemOriginalFilter, origemUltimoFilter } = crmFilters;
  const leadFilterWhere = buildLeadFilterWhere(filterType, filterValue);

  const andClauses: Prisma.LeadCrmWhereInput[] = [
    ...(paidOnly ? [buildPaidMediaWhere()] : []),
    ...(tagFilter.length > 0 ? [buildTagFilterWhere(tagFilter)] : []),
    ...(conversaoOriginalFilter.length > 0 ? [buildJsonStringFilterWhere("conversaoOriginal", conversaoOriginalFilter)] : []),
    ...(conversaoUltimoFilter.length > 0 ? [buildJsonStringFilterWhere("conversaoUltimo", conversaoUltimoFilter)] : []),
    ...(midiaFilter.length > 0 ? [buildJsonStringFilterWhere("midiaOriginal", midiaFilter)] : []),
    ...(origemOriginalFilter.length > 0 ? [buildJsonStringFilterWhere("origem", origemOriginalFilter)] : []),
    ...(origemUltimoFilter.length > 0 ? [buildJsonStringFilterWhere("origemUltimo", origemUltimoFilter)] : []),
    ...(filterType && filterValue ? [leadFilterWhere] : []),
  ];

  const leads = await prisma.leadCrm.findMany({
    where: {
      clienteId: id,
      dataEntrada: { gte: dateFrom, lte: dateTo },
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    },
    select: { fonte: true, valor: true, dataFechamento: true, status: true, rating: true, dadosCv: true, etapa: true, dadosMarketing: true, metaLeadId: true },
  });

  // Build a fallback map: metaLeadId → MetaLeadIndividual attribution data
  // Used to attribute leads that have metaLeadId but no campaign info in dadosMarketing
  const leadMetaIds = leads.map((l) => l.metaLeadId).filter((id): id is string => !!id);
  const metaLeadAttrMap = new Map<string, {
    campaignId: string | null; campaignName: string | null;
    adsetId: string | null; adsetName: string | null;
    adId: string | null; adName: string | null;
  }>();
  if (leadMetaIds.length > 0) {
    const metaAttrRows = await prisma.metaLeadIndividual.findMany({
      where: { clienteId: id, metaLeadId: { in: leadMetaIds } },
      select: { metaLeadId: true, campaignId: true, campaignName: true, adsetId: true, adsetName: true, adId: true, adName: true },
    });
    for (const r of metaAttrRows) {
      metaLeadAttrMap.set(r.metaLeadId, {
        campaignId: r.campaignId ?? null,
        campaignName: r.campaignName ?? null,
        adsetId: r.adsetId ?? null,
        adsetName: r.adsetName ?? null,
        adId: r.adId ?? null,
        adName: r.adName ?? null,
      });
    }
  }

  const fatoRows = await prisma.fatoMidiaDiario.findMany({
    where: { clienteId: id, data: { gte: dateFrom, lte: dateTo }, canal: { in: ["META", "GOOGLE"] } },
    select: { canal: true, investimento: true, leads: true, conversoes: true },
  });

  const investMeta = fatoRows.filter((r) => r.canal === "META").reduce((s, r) => s + Number(r.investimento), 0);
  const investGoogle = fatoRows.filter((r) => r.canal === "GOOGLE").reduce((s, r) => s + Number(r.investimento), 0);
  const leadsMeta = fatoRows.filter((r) => r.canal === "META").reduce((s, r) => s + Math.max(r.leads, r.conversoes), 0);
  const leadsGoogle = fatoRows.filter((r) => r.canal === "GOOGLE").reduce((s, r) => s + Math.max(r.leads, r.conversoes), 0);

  type Bucket = {
    leads: number; ganhos: number; perdidos: number; andamento: number;
    valor: number; ratingSum: number; ratingCount: number; visitou: number;
    pvSum: number; pvCount: number;
  };

  const emptyBucket = (): Bucket => ({
    leads: 0, ganhos: 0, perdidos: 0, andamento: 0, valor: 0,
    ratingSum: 0, ratingCount: 0, visitou: 0, pvSum: 0, pvCount: 0,
  });

  const fonteMap = new Map<string, Bucket>();
  const canalMap = new Map<string, Bucket>();
  const estadoMap = new Map<string, Bucket>();
  const conversaoMap = new Map<string, Bucket>();
  const campanhaMap = new Map<string, { canal: Canal } & Bucket>();
  const criativoMap = new Map<string, { adId: string | null; adsetName: string | null; campaignName: string | null } & Bucket>();
  const campanhaConfirmadaMap = new Map<string, Bucket>();

  // Hierarquia Meta (campanha → conjunto → anúncio) a partir do dadosMarketing do lead
  type MetaNode = Bucket & { id: string | null; name: string };
  type MetaAdset = MetaNode & { ads: Map<string, MetaNode> };
  type MetaCampanha = MetaNode & { adsets: Map<string, MetaAdset> };
  const metaHierMap = new Map<string, MetaCampanha>();

  // Hierarquia Google UTM (campanha via utm_campaign do dadosMarketing) — usado para leads RD CRM
  const googleUtmHierMap = new Map<string, Bucket>();

  // Tag tracking
  const tagMap = new Map<string, number>();
  let leadsComTags = 0;
  let alertaLeads = 0;

  let leadsComEstado = 0;
  let leadsComConversao = 0;
  let metaLeadsConfirmados = 0;
  let visitasCount = 0;

  for (const lead of leads) {
    const cv = parseDadosCv(lead.dadosCv);
    const midiaOriginal = cv?.midiaOriginal?.trim() ?? null;
    // Extract RD Marketing enrichment for improved channel detection
    const mktRaw = parseDadosMarketing(lead.dadosMarketing);
    const rdEnrichment = mktRaw ? {
      rdTags: Array.isArray((mktRaw as Record<string, unknown>).rdTags) ? (mktRaw as Record<string, unknown>).rdTags as string[] : null,
      trafficSource: (mktRaw as Record<string, unknown>).trafficSource as string | null ?? null,
      utmSource: (mktRaw as Record<string, unknown>).utmSource as string | null ?? null,
      utmMedium: (mktRaw as Record<string, unknown>).utmMedium as string | null ?? null,
    } : null;
    const canal = canalFromMidia(midiaOriginal, lead.fonte, rdEnrichment);

    const isWon = lead.status === "won";
    const isLost = lead.status === "lost";
    const valor = lead.valor ? Number(lead.valor) : 0;
    const rating = lead.rating ?? null;
    const etapaLower = norm(lead.etapa ?? "");
    const visitou = etapaLower.includes("visit");
    if (visitou) visitasCount++;

    // possibilidadeVenda 1-5 (manual broker assessment)
    const pv = parsePv(cv?.possibilidadeVenda);

    // Tags — handle string, comma-separated, or array storage formats
    const rawTags = parseTags(cv?.tags);
    if (rawTags.length > 0) {
      leadsComTags++;
      let hasAlerta = false;
      for (const t of rawTags) {
        const key = norm(t.trim());
        if (key) {
          tagMap.set(key, (tagMap.get(key) ?? 0) + 1);
          if (isAlertaTag(key)) hasAlerta = true;
        }
      }
      if (hasAlerta) alertaLeads++;
    }

    const applyBucket = (b: Bucket) => {
      b.leads++;
      if (visitou) b.visitou++;
      if (isWon) { b.ganhos++; b.valor += valor; } else if (isLost) b.perdidos++; else b.andamento++;
      if (rating != null) { b.ratingSum += rating; b.ratingCount++; }
      if (pv != null) { b.pvSum += pv; b.pvCount++; }
    };

    const addTo = (map: Map<string, Bucket>, key: string) => {
      let b = map.get(key);
      if (!b) { b = emptyBucket(); map.set(key, b); }
      applyBucket(b);
    };

    // Hierarquia Meta: usa dadosMarketing do lead; fallback para MetaLeadIndividual via metaLeadId
    const mkt = parseDadosMarketing(lead.dadosMarketing);
    const hasMktCamp = !!(mkt?.metaCampaignId || mkt?.metaCampaignName);
    const fallbackAttr = !hasMktCamp && lead.metaLeadId ? metaLeadAttrMap.get(lead.metaLeadId) : null;

    const campId   = (hasMktCamp ? mkt!.metaCampaignId?.trim() : fallbackAttr?.campaignId) || null;
    const campName = (hasMktCamp ? mkt!.metaCampaignName?.trim() : fallbackAttr?.campaignName) || null;

    if (campId || campName) {
      const campLabel  = campName || "(sem campanha)";
      const campKey    = campId || campLabel;
      const adsetId    = (hasMktCamp ? mkt!.metaAdsetId?.trim() : fallbackAttr?.adsetId) || null;
      const adsetName  = (hasMktCamp ? mkt!.metaAdsetName?.trim() : fallbackAttr?.adsetName) || "(sem conjunto)";
      const adsetKey   = adsetId || adsetName;
      const adId       = (hasMktCamp ? mkt!.metaAdId?.trim() : fallbackAttr?.adId) || null;
      const adName     = (hasMktCamp ? mkt!.metaAdName?.trim() : fallbackAttr?.adName) || "(sem anúncio)";
      const adKey      = adId || adName;

      let camp = metaHierMap.get(campKey);
      if (!camp) { camp = { id: campId, name: campLabel, ...emptyBucket(), adsets: new Map() }; metaHierMap.set(campKey, camp); }
      applyBucket(camp);

      let adset = camp.adsets.get(adsetKey);
      if (!adset) { adset = { id: adsetId, name: adsetName, ...emptyBucket(), ads: new Map() }; camp.adsets.set(adsetKey, adset); }
      applyBucket(adset);

      let ad = adset.ads.get(adKey);
      if (!ad) { ad = { id: adId, name: adName, ...emptyBucket() }; adset.ads.set(adKey, ad); }
      applyBucket(ad);
    }

    // Hierarquia Google UTM: agrupa leads GOOGLE por utm_campaign (dadosMarketing)
    if (canal === "GOOGLE") {
      const utmCamp = mkt?.utmCampaign?.trim() || null;
      if (utmCamp) {
        let g = googleUtmHierMap.get(utmCamp);
        if (!g) { g = emptyBucket(); googleUtmHierMap.set(utmCamp, g); }
        applyBucket(g);
      }
    }

    addTo(fonteMap, lead.fonte ?? "(sem fonte)");
    addTo(canalMap, canal);

    const estado = cv?.estado?.trim() || null;
    if (estado) { leadsComEstado++; addTo(estadoMap, estado); }

    const conversao = cv?.conversaoOriginal?.trim() || midiaOriginal || null;
    if (conversao) { leadsComConversao++; addTo(conversaoMap, conversao); }

    const conversaoKey = cv?.conversaoOriginal?.trim() ?? null;
    if (conversaoKey && (canal === "META" || canal === "GOOGLE")) {
      const cKey = `${canal}:::${conversaoKey}`;
      let b = campanhaMap.get(cKey);
      if (!b) { b = { canal, ...emptyBucket() }; campanhaMap.set(cKey, b); }
      b.leads++;
      if (visitou) b.visitou++;
      if (isWon) { b.ganhos++; b.valor += valor; } else if (isLost) b.perdidos++; else b.andamento++;
      if (rating != null) { b.ratingSum += rating; b.ratingCount++; }
      if (pv != null) { b.pvSum += pv; b.pvCount++; }
    }
  }

  // ── porCriativo + porCampanhaConfirmada ─────────────────────────────────────
  const metaLeadForms = await prisma.metaLeadIndividual.findMany({
    where: { clienteId: id, createdTime: { gte: dateFrom, lte: dateTo } },
    select: { metaLeadId: true, adName: true, adId: true, adsetName: true, campaignName: true, fullName: true, emailLead: true, createdTime: true },
  });

  const totalLeadsMeta = metaLeadForms.length;
  let reconversoesMeta: Array<{
    metaLeadId: string; fullName: string | null; emailLead: string | null; createdTime: Date;
    campaignName: string | null; adsetName: string | null; adName: string | null;
    dataEntrada: Date; etapa: string | null;
  }> = [];

  if (metaLeadForms.length > 0) {
    const metaLeadIds = metaLeadForms.map((ml) => ml.metaLeadId);
    // Apply tag filter (and leadFilter) so porCriativo only counts leads that
    // passed the configured filters — not all raw Meta form submissions.
    const crmMatched = await prisma.leadCrm.findMany({
      where: {
        clienteId: id,
        metaLeadId: { in: metaLeadIds },
        ...(andClauses.length > 0 ? { AND: andClauses } : {}),
      },
      select: { metaLeadId: true, status: true, valor: true, etapa: true, rating: true },
    });
    const crmByMeta = new Map(crmMatched.map((l) => [l.metaLeadId!, l]));

    // metaLeadsConfirmados = how many forms matched a tag-filtered CRM lead
    metaLeadsConfirmados = crmByMeta.size;

    for (const ml of metaLeadForms) {
      const crm = crmByMeta.get(ml.metaLeadId);
      // Only count this form if it corresponds to a tag-filtered CRM lead
      if (!crm) continue;

      const adName = ml.adName?.trim() ?? "(sem nome)";

      let cb = criativoMap.get(adName);
      if (!cb) {
        cb = { adId: ml.adId ?? null, adsetName: ml.adsetName ?? null, campaignName: ml.campaignName ?? null, ...emptyBucket() };
        criativoMap.set(adName, cb);
      }
      cb.leads++;

      if (ml.campaignName) {
        const campKey = ml.campaignName.trim();
        let ccb = campanhaConfirmadaMap.get(campKey);
        if (!ccb) { ccb = emptyBucket(); campanhaConfirmadaMap.set(campKey, ccb); }
        ccb.leads++;
      }

      {
        const isWon = crm.status === "won";
        const isLost = crm.status === "lost";
        const etapaLower = norm(crm.etapa ?? "");
        const visitouCrm = etapaLower.includes("visit");
        const valorCrm = crm.valor ? Number(crm.valor) : 0;
        const r = crm.rating ?? null;

        if (visitouCrm) cb.visitou++;
        if (isWon) { cb.ganhos++; cb.valor += valorCrm; } else if (isLost) cb.perdidos++; else cb.andamento++;
        if (r != null) { cb.ratingSum += r; cb.ratingCount++; }

        if (ml.campaignName) {
          const ccb = campanhaConfirmadaMap.get(ml.campaignName.trim())!;
          if (visitouCrm) ccb.visitou++;
          if (isWon) { ccb.ganhos++; ccb.valor += valorCrm; } else if (isLost) ccb.perdidos++; else ccb.andamento++;
          if (r != null) { ccb.ratingSum += r; ccb.ratingCount++; }
        }
      }
    }

    // ── Reconversões: forms in period not matched to CRM, but email exists in CRM ──
    // Use unfiltered CRM metaLeadIds — active tag/UI filters must NOT affect reconversão detection
    const allCrmMetaLeadIdRows = await prisma.leadCrm.findMany({
      where: { clienteId: id, metaLeadId: { not: null } },
      select: { metaLeadId: true },
    });
    const allCrmMetaLeadIds = new Set(allCrmMetaLeadIdRows.map((r) => r.metaLeadId as string));
    const unmatchedForms = metaLeadForms.filter((ml) => !allCrmMetaLeadIds.has(ml.metaLeadId));
    if (unmatchedForms.length > 0) {
      const unmatchedEmails = unmatchedForms
        .map((ml) => ml.emailLead?.trim())
        .filter((e): e is string => !!e && e.length > 0);
      if (unmatchedEmails.length > 0) {
        const allCrmWithEmail = await prisma.leadCrm.findMany({
          where: { clienteId: id, email: { not: null } },
          select: { email: true, dataEntrada: true, etapa: true },
          orderBy: { dataEntrada: "asc" },
        });
        const crmEmailMap = new Map<string, { dataEntrada: Date; etapa: string | null }>();
        for (const row of allCrmWithEmail) {
          const key = (row.email ?? "").trim().toLowerCase();
          if (key && !crmEmailMap.has(key)) crmEmailMap.set(key, { dataEntrada: row.dataEntrada, etapa: row.etapa });
        }
        reconversoesMeta = unmatchedForms
          .map((ml) => {
            const key = (ml.emailLead ?? "").trim().toLowerCase();
            const crm = crmEmailMap.get(key);
            if (!crm) return null;
            return {
              metaLeadId: ml.metaLeadId,
              fullName: ml.fullName ?? null,
              emailLead: ml.emailLead ?? null,
              createdTime: ml.createdTime,
              campaignName: ml.campaignName ?? null,
              adsetName: ml.adsetName ?? null,
              adName: ml.adName ?? null,
              dataEntrada: crm.dataEntrada,
              etapa: crm.etapa ?? null,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      }
    }
  }

  // ── Reconversões Google: GOOGLE CRM leads in period whose email existed in CRM before the period ──
  let reconversoesGoogle: Array<{
    leadCrmId: string; nome: string | null; email: string;
    dataEntrada: Date; fonte: string | null; utmCampaign: string | null;
    dataEntradaAnterior: Date; etapa: string | null;
  }> = [];

  {
    // Fetch unfiltered CRM leads in period with email (no andClauses — matches Meta approach)
    const periodLeadsWithEmail = await prisma.leadCrm.findMany({
      where: { clienteId: id, dataEntrada: { gte: dateFrom, lte: dateTo }, email: { not: null } },
      select: { id: true, nome: true, email: true, fonte: true, etapa: true, dataEntrada: true, dadosCv: true, dadosMarketing: true },
    });

    // Filter to GOOGLE-attributed leads using the same canal detection logic
    const googleCrmInPeriod = periodLeadsWithEmail.filter((l) => {
      const cv = parseDadosCv(l.dadosCv);
      const mktRaw = parseDadosMarketing(l.dadosMarketing);
      const rdEnr = mktRaw ? {
        rdTags: Array.isArray((mktRaw as Record<string, unknown>).rdTags) ? (mktRaw as Record<string, unknown>).rdTags as string[] : null,
        trafficSource: (mktRaw as Record<string, unknown>).trafficSource as string | null ?? null,
        utmSource: (mktRaw as Record<string, unknown>).utmSource as string | null ?? null,
        utmMedium: (mktRaw as Record<string, unknown>).utmMedium as string | null ?? null,
      } : null;
      return canalFromMidia(cv?.midiaOriginal?.trim() ?? null, l.fonte, rdEnr) === "GOOGLE";
    });

    if (googleCrmInPeriod.length > 0) {
      // Find the earliest CRM lead per email across ALL dates (not just before dateFrom).
      // This catches cross-channel duplicates within the same period — e.g. someone who
      // first converted via Meta in February and then via Google in April (both in YTD).
      // We keep the earliest entry per email; if a Google lead IS the earliest, it's genuine.
      const allCrmEmailRows = await prisma.leadCrm.findMany({
        where: { clienteId: id, email: { not: null } },
        select: { id: true, email: true, dataEntrada: true },
        orderBy: { dataEntrada: "asc" },
      });
      // Map email → { id, dataEntrada } of the FIRST (oldest) occurrence
      const firstByEmail = new Map<string, { id: string; dataEntrada: Date }>();
      for (const row of allCrmEmailRows) {
        const key = (row.email ?? "").trim().toLowerCase();
        if (key && !firstByEmail.has(key)) firstByEmail.set(key, { id: row.id, dataEntrada: row.dataEntrada });
      }

      reconversoesGoogle = googleCrmInPeriod
        .map((l) => {
          const key = (l.email ?? "").trim().toLowerCase();
          const first = firstByEmail.get(key);
          // Not a duplicate if: no other lead found, or THIS lead is the first/oldest occurrence
          if (!first || first.id === l.id) return null;
          const prevDate = first.dataEntrada;
          const mkt = parseDadosMarketing(l.dadosMarketing);
          return {
            leadCrmId: l.id,
            nome: l.nome ?? null,
            email: l.email as string,
            dataEntrada: l.dataEntrada,
            fonte: l.fonte ?? null,
            utmCampaign: mkt?.utmCampaign ?? null,
            dataEntradaAnterior: prevDate,
            etapa: l.etapa ?? null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }
  }

  const toRow = (key: string, b: Bucket) => ({
    key,
    leads: b.leads,
    ganhos: b.ganhos,
    perdidos: b.perdidos,
    andamento: b.andamento,
    visitou: b.visitou,
    valor: b.valor,
    taxaGanho: b.leads > 0 ? Math.round((b.ganhos / b.leads) * 100) : 0,
    taxaPerda: b.leads > 0 ? Math.round((b.perdidos / b.leads) * 100) : 0,
    ratingMedio: b.ratingCount > 0 ? Math.round((b.ratingSum / b.ratingCount) * 10) / 10 : null,
    pvMedio: b.pvCount > 0 ? Math.round((b.pvSum / b.pvCount) * 10) / 10 : null,
  });

  const porFonte = [...fonteMap.entries()]
    .map(([fonte, b]) => {
      const canal = canalFromMidia(null, fonte === "(sem fonte)" ? null : fonte);
      return {
        fonte, canal,
        ...toRow(fonte, b),
        investCanal: canal === "META" ? investMeta : canal === "GOOGLE" ? investGoogle : null,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  const CANAL_ORDER: Canal[] = ["META", "GOOGLE", "ORGANICO", "INDICACAO", "DIRETO", "OUTRO"];
  const porCanal = [...canalMap.entries()]
    .map(([canal, b]) => ({
      canal, ...toRow(canal, b),
      investCanal: canal === "META" ? investMeta : canal === "GOOGLE" ? investGoogle : null,
    }))
    .sort((a, b) => CANAL_ORDER.indexOf(a.canal as Canal) - CANAL_ORDER.indexOf(b.canal as Canal));

  const porEstado = [...estadoMap.entries()]
    .map(([estado, b]) => ({ estado, ...toRow(estado, b) }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 20);

  const porConversao = [...conversaoMap.entries()]
    .map(([conversao, b]) => ({ conversao, ...toRow(conversao, b) }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 50);

  const porCampanha = [...campanhaMap.entries()]
    .map(([cKey, b]) => {
      const campanha = cKey.includes(":::") ? cKey.split(":::")[1] : cKey;
      return {
        campanha, canal: b.canal,
        ...toRow(campanha, b),
        investCanal: b.canal === "META" ? investMeta : b.canal === "GOOGLE" ? investGoogle : null,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  // Enrich porCriativo with Meta Ads performance metrics (spend/impressions/clicks)
  const adIds = [...criativoMap.values()]
    .map((v) => v.adId)
    .filter((aid): aid is string => aid != null);

  const metaSpendByAdId = new Map<string, { spend: number; impressions: number; clicks: number }>();
  if (adIds.length > 0) {
    const metaRows = await prisma.metaAdsCriativo.groupBy({
      by: ["adId"],
      where: { clienteId: id, adId: { in: adIds }, data: { gte: dateFrom, lte: dateTo } },
      _sum: { spend: true, impressions: true, clicks: true },
    });
    for (const row of metaRows) {
      metaSpendByAdId.set(row.adId, {
        spend: Number(row._sum.spend ?? 0),
        impressions: Number(row._sum.impressions ?? 0),
        clicks: Number(row._sum.clicks ?? 0),
      });
    }
  }

  const porCriativo = [...criativoMap.entries()]
    .map(([adName, b]) => {
      const meta = b.adId ? metaSpendByAdId.get(b.adId) : null;
      return {
        adName,
        adId: b.adId,
        adsetName: b.adsetName,
        campaignName: b.campaignName,
        ...toRow(adName, b),
        spend: meta?.spend ?? 0,
        impressions: meta?.impressions ?? 0,
        clicks: meta?.clicks ?? 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  // ── porMetaHierarquia (campanha → conjunto → anúncio via dadosMarketing) ──────
  const campanhas = [...metaHierMap.values()];
  const hierCampIds = campanhas.map((c) => c.id).filter((x): x is string => !!x);
  const hierAdsetIds = campanhas.flatMap((c) => [...c.adsets.values()].map((a) => a.id)).filter((x): x is string => !!x);
  const hierAdIds = campanhas.flatMap((c) => [...c.adsets.values()].flatMap((a) => [...a.ads.values()].map((ad) => ad.id))).filter((x): x is string => !!x);

  const campSpend = new Map<string, number>();
  const adsetSpend = new Map<string, number>();
  const adSpendHier = new Map<string, number>();
  if (hierCampIds.length > 0) {
    const rows = await prisma.metaAdsCriativo.groupBy({
      by: ["campaignId"],
      where: { clienteId: id, campaignId: { in: hierCampIds }, data: { gte: dateFrom, lte: dateTo } },
      _sum: { spend: true },
    });
    for (const r of rows) if (r.campaignId) campSpend.set(r.campaignId, Number(r._sum.spend ?? 0));
  }
  if (hierAdsetIds.length > 0) {
    const rows = await prisma.metaAdsCriativo.groupBy({
      by: ["adsetId"],
      where: { clienteId: id, adsetId: { in: hierAdsetIds }, data: { gte: dateFrom, lte: dateTo } },
      _sum: { spend: true },
    });
    for (const r of rows) if (r.adsetId) adsetSpend.set(r.adsetId, Number(r._sum.spend ?? 0));
  }
  if (hierAdIds.length > 0) {
    const rows = await prisma.metaAdsCriativo.groupBy({
      by: ["adId"],
      where: { clienteId: id, adId: { in: hierAdIds }, data: { gte: dateFrom, lte: dateTo } },
      _sum: { spend: true },
    });
    for (const r of rows) adSpendHier.set(r.adId, Number(r._sum.spend ?? 0));
  }

  const hierNode = (b: typeof campanhas[number] | MetaAdset | MetaNode) => ({
    leads: b.leads,
    ganhos: b.ganhos,
    perdidos: b.perdidos,
    andamento: b.andamento,
    visitou: b.visitou,
    valor: b.valor,
    taxaGanho: b.leads > 0 ? Math.round((b.ganhos / b.leads) * 100) : 0,
  });

  const porMetaHierarquia = campanhas
    .map((camp) => ({
      campaignId: camp.id,
      campaignName: camp.name,
      spend: camp.id ? (campSpend.get(camp.id) ?? 0) : 0,
      ...hierNode(camp),
      adsets: [...camp.adsets.values()]
        .map((as) => ({
          adsetId: as.id,
          adsetName: as.name,
          spend: as.id ? (adsetSpend.get(as.id) ?? 0) : 0,
          ...hierNode(as),
          ads: [...as.ads.values()]
            .map((ad) => ({
              adId: ad.id,
              adName: ad.name,
              spend: ad.id ? (adSpendHier.get(ad.id) ?? 0) : 0,
              ...hierNode(ad),
            }))
            .sort((a, b) => b.leads - a.leads),
        }))
        .sort((a, b) => b.leads - a.leads),
    }))
    .sort((a, b) => b.leads - a.leads);

  const totalLeads = leads.length;
  const totalGanhos = leads.filter((l) => l.status === "won").length;
  const totalPerdidos = leads.filter((l) => l.status === "lost").length;
  const totalAndamento = totalLeads - totalGanhos - totalPerdidos;
  const totalValor = leads.filter((l) => l.status === "won").reduce((s, l) => s + (l.valor ? Number(l.valor) : 0), 0);
  const metaCrmLeads = porCanal.find((c) => c.canal === "META")?.leads ?? 0;
  const googleCrmLeads = porCanal.find((c) => c.canal === "GOOGLE")?.leads ?? 0;
  const metaGanhos = porCanal.find((c) => c.canal === "META")?.ganhos ?? 0;
  const googleGanhos = porCanal.find((c) => c.canal === "GOOGLE")?.ganhos ?? 0;

  const porCampanhaConfirmada = [...campanhaConfirmadaMap.entries()]
    .map(([campaignName, b]) => ({
      campaignName,
      ...toRow(campaignName, b),
    }))
    .sort((a, b) => b.leads - a.leads);

  // ── porGoogleUtmHier (campanha UTM → leads) ─────────────────────────────────
  const porGoogleUtmHier = [...googleUtmHierMap.entries()]
    .map(([campaignName, b]) => ({
      campaignName,
      ...toRow(campaignName, b),
    }))
    .sort((a, b) => b.leads - a.leads);

  // Tag breakdown — exclude tags that are part of any configured filter dimension
  // (they are filter criteria stored on leads as tracking metadata, not quality signals).
  const tagFilterNorm = new Set([
    ...tagFilter,
    ...conversaoOriginalFilter,
    ...conversaoUltimoFilter,
    ...midiaFilter,
    ...origemUltimoFilter,
  ].map((t) => norm(t.trim())));
  const porTags = [...tagMap.entries()]
    .filter(([tag]) => !tagFilterNorm.has(tag))
    .map(([tag, count]) => ({ tag, count, isAlerta: isAlertaTag(tag) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return NextResponse.json({
    configured: true,
    periodo: { from: dateFrom, to: dateTo },
    totalLeads, totalGanhos, totalPerdidos, totalAndamento, totalValor,
    investMeta, investGoogle, leadsMeta, leadsGoogle, metaCrmLeads, googleCrmLeads,
    metaLeadsConfirmados,
    cplMetaCampanha: leadsMeta > 0 ? investMeta / leadsMeta : null,
    cplGoogleCampanha: leadsGoogle > 0 ? investGoogle / leadsGoogle : null,
    cplMetaCrm: metaCrmLeads > 0 ? investMeta / metaCrmLeads : null,
    cplGoogleCrm: googleCrmLeads > 0 ? investGoogle / googleCrmLeads : null,
    cplMetaConfirmado: metaLeadsConfirmados > 0 ? investMeta / metaLeadsConfirmados : null,
    cacMetaCrm: metaGanhos > 0 && investMeta > 0 ? investMeta / metaGanhos : null,
    cacGoogleCrm: googleGanhos > 0 && investGoogle > 0 ? investGoogle / googleGanhos : null,
    porFonte, porCanal, porEstado, porConversao, porCampanha, porCriativo,
    porCampanhaConfirmada, porMetaHierarquia, porGoogleUtmHier,
    totalLeadsMeta, reconversoesMeta,
    reconversoesGoogle,
    leadsComEstado, leadsComConversao,
    porTags, totalComTags: leadsComTags, alertaLeads,
    visitasCount, vendasCount: totalGanhos,
    ultimoSyncAt: config.ultimoSyncAt,
  });
}
