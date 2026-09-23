import { NextRequest, NextResponse } from "next/server";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";

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
  const access = await requireClienteAccess(request, id, "read");
  if (access.response) return access.response;
  const sp = request.nextUrl.searchParams;
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

  const rows = await prisma.linkedInAdsCampanha.findMany({
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
    leads: number;
  }>();

  for (const r of rows) {
    const nome = r.campaignName;
    const ex = byCamp.get(nome);
    if (ex) {
      ex.investimento += Number(r.custo);
      ex.impressoes += r.impressoes;
      ex.cliques += r.cliques;
      ex.conversoes += r.conversoes;
      ex.leads += r.leads;
      if (r.campaignStatus) ex.campaignStatus = r.campaignStatus;
      if (r.campaignType) ex.campaignType = r.campaignType;
    } else {
      byCamp.set(nome, {
        campaignId: r.campaignId,
        campaignStatus: r.campaignStatus ?? null,
        campaignType: r.campaignType ?? null,
        investimento: Number(r.custo),
        impressoes: r.impressoes,
        cliques: r.cliques,
        conversoes: r.conversoes,
        leads: r.leads,
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
      leads: v.leads,
      ctr: v.impressoes > 0 ? (v.cliques / v.impressoes) * 100 : null,
      cpc: v.cliques > 0 ? v.investimento / v.cliques : null,
      custoConversao: v.conversoes > 0 ? v.investimento / v.conversoes : null,
      cpl: v.leads > 0 ? v.investimento / v.leads : null,
    }))
    .filter((c) => c.investimento > 0 || c.impressoes > 0)
    .sort((a, b) => b.investimento - a.investimento);

  return NextResponse.json({ campanhas });
}
