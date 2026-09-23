import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { fetchAdLevelInsights } from "@/lib/meta/metaClient";

function parseNum(v: string | undefined | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getAction(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  return (actions ?? [])
    .filter((a) => a.action_type === type)
    .reduce((sum, a) => sum + parseNum(a.value), 0);
}

const ID_PATTERN = /\[ID[:\s]+([^\]]+)\]/i;

function parsePropertyIds(adName: string): string[] {
  const match = adName.match(ID_PATTERN);
  if (!match) return [];
  return match[1]
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

function extractPropertyName(adName: string): string {
  const cleaned = adName.replace(ID_PATTERN, "").trim();
  if (!cleaned || cleaned.startsWith("[")) return "";
  return cleaned
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface ImoveisResponseItem {
  id: string;
  nome: string;
  conversas: number;
  leads: number;
  total: number;
  spend: number;
  anuncios: number;
}

export interface ImoveisResponse {
  imoveis: ImoveisResponseItem[];
  semId: {
    conversas: number;
    leads: number;
    total: number;
    spend: number;
    anuncios: number;
  };
  totalAnuncios: number;
  dataInicio: string;
  dataFim: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params;

  const searchParams = request.nextUrl.searchParams;
  const dataInicioParam = searchParams.get("dataInicio");
  const dataFimParam = searchParams.get("dataFim");
  const fallbackDays = Math.min(365, Math.max(1, parseInt(searchParams.get("periodo") ?? "30", 10) || 30));

  const dataFim = parseDateOnly(dataFimParam) ?? new Date();
  const dataInicio =
    parseDateOnly(dataInicioParam) ??
    new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate() - (fallbackDays - 1));

  const dataInicioStr = formatDateOnly(dataInicio);
  const dataFimStr = formatDateOnly(dataFim);

  const config = await getIntegrationsConfig();
  const token = config.metaAccessToken ?? process.env.META_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "META_ACCESS_TOKEN não configurado" },
      { status: 503 }
    );
  }

  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "META" },
  });

  if (!conta?.accountIdPlataforma) {
    return NextResponse.json(
      { error: "Cliente sem conta Meta configurada" },
      { status: 404 }
    );
  }

  const adRows = await fetchAdLevelInsights(
    conta.accountIdPlataforma,
    token,
    dataInicioStr,
    dataFimStr
  );

  type Accumulator = {
    nome: string;
    conversas: number;
    leads: number;
    total: number;
    spend: number;
    adIds: Set<string>;
  };

  const byId = new Map<string, Accumulator>();
  let semIdConversas = 0;
  let semIdLeads = 0;
  let semIdSpend = 0;
  const semIdAds = new Set<string>();

  for (const row of adRows) {
    const conversas = getAction(row.actions, "onsite_conversion.messaging_conversation_started_7d");
    const leads = getAction(row.actions, "onsite_conversion.lead_grouped");
    const total = conversas + leads;
    const spend = parseNum(row.spend);

    const ids = parsePropertyIds(row.ad_name);

    if (ids.length === 0) {
      semIdConversas += conversas;
      semIdLeads += leads;
      semIdSpend += spend;
      semIdAds.add(row.ad_id);
      continue;
    }

    const nome = extractPropertyName(row.ad_name);

    for (const propId of ids) {
      const existing = byId.get(propId);
      if (existing) {
        existing.conversas += conversas;
        existing.leads += leads;
        existing.total += total;
        existing.spend += spend;
        existing.adIds.add(row.ad_id);
        if (!existing.nome && nome) existing.nome = nome;
      } else {
        byId.set(propId, {
          nome,
          conversas,
          leads,
          total,
          spend,
          adIds: new Set([row.ad_id]),
        });
      }
    }
  }

  const imoveis: ImoveisResponseItem[] = Array.from(byId.entries())
    .map(([id, acc]) => ({
      id,
      nome: acc.nome,
      conversas: acc.conversas,
      leads: acc.leads,
      total: acc.total,
      spend: acc.spend,
      anuncios: acc.adIds.size,
    }))
    .sort((a, b) => b.total - a.total || b.conversas - a.conversas);

  const response: ImoveisResponse = {
    imoveis,
    semId: {
      conversas: semIdConversas,
      leads: semIdLeads,
      total: semIdConversas + semIdLeads,
      spend: semIdSpend,
      anuncios: semIdAds.size,
    },
    totalAnuncios: adRows.length,
    dataInicio: dataInicioStr,
    dataFim: dataFimStr,
  };

  return NextResponse.json(response);
}
