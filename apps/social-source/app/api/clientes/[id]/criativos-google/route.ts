import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findClienteById } from "@/lib/repositories/clientesRepository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const periodo = request.nextUrl.searchParams.get("periodo") ?? "90";
  const ordenarPor = request.nextUrl.searchParams.get("ordenarPor") ?? "impressoes";

  const cliente = await findClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const dias = Math.min(365, Math.max(7, parseInt(periodo, 10) || 90));
  const dataFim = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);

  const criativos = await prisma.googleAdsCriativo.findMany({
    where: {
      clienteId: id,
      data: { gte: dataInicio, lte: dataFim },
    },
    orderBy: { data: "desc" },
  });

  const byAd = new Map<
    string,
    {
      adResourceName: string;
      campaignName: string | null;
      adGroupName: string | null;
      headline1: string | null;
      headline2: string | null;
      description: string | null;
      impressoes: number;
      cliques: number;
      custoMicros: bigint;
      conversoes: number;
    }
  >();

  for (const c of criativos) {
    const existing = byAd.get(c.adResourceName);
    const imp = c.impressoes;
    const clk = c.cliques;
    const custo = c.custoMicros;
    const conv = c.conversoes;

    if (existing) {
      existing.impressoes += imp;
      existing.cliques += clk;
      existing.custoMicros += custo;
      existing.conversoes += conv;
    } else {
      byAd.set(c.adResourceName, {
        adResourceName: c.adResourceName,
        campaignName: c.campaignName,
        adGroupName: c.adGroupName,
        headline1: c.headline1,
        headline2: c.headline2,
        description: c.description,
        impressoes: imp,
        cliques: clk,
        custoMicros: custo,
        conversoes: conv,
      });
    }
  }

  const sorted = Array.from(byAd.values())
    .map((a) => ({
      ...a,
      investimento: Number(a.custoMicros) / 1_000_000,
      ctr: a.impressoes > 0 ? (a.cliques / a.impressoes) * 100 : 0,
    }))
    .sort((a, b) => {
      if (ordenarPor === "impressoes") return b.impressoes - a.impressoes;
      if (ordenarPor === "cliques") return b.cliques - a.cliques;
      if (ordenarPor === "investimento") return b.investimento - a.investimento;
      if (ordenarPor === "conversoes") return b.conversoes - a.conversoes;
      return b.impressoes - a.impressoes;
    });

  return NextResponse.json({
    clienteId: id,
    periodo: dias,
    ordenarPor,
    criativos: sorted,
  });
}
