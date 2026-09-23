import { NextResponse } from "next/server";
import { findAllClientes } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";
import { outcomeCountForFato } from "@/lib/metrics/fatoMidiaOutcome";

export async function GET() {
  try {
    const clientes = await findAllClientes(true);
    const ids = clientes.map((c) => c.id);
    if (ids.length === 0) {
      return NextResponse.json(
        clientes.map((c) => ({ ...c, totalLeads: 0, conversao: 0, squad: c.squad ?? null }))
      );
    }
    const fatosRows = await prisma.fatoMidiaDiario.findMany({
      where: { clienteId: { in: ids } },
      select: { clienteId: true, canal: true, leads: true, conversoes: true, cliques: true, messagingConversationsStarted: true },
    });
    const byCliente = new Map<string, { totalLeads: number; totalCliques: number }>();
    for (const r of fatosRows) {
      const cur = byCliente.get(r.clienteId) ?? { totalLeads: 0, totalCliques: 0 };
      cur.totalLeads += outcomeCountForFato(r.canal, r.leads, r.conversoes);
      cur.totalCliques += r.cliques;
      byCliente.set(r.clienteId, cur);
    }
    const withKpis = clientes.map((c) => {
      const agg = byCliente.get(c.id);
      const hasGoogleConta = c.contas.some((conta) => conta.plataforma === "GOOGLE_ADS");
      const hasMetaConta = c.contas.some((conta) => conta.plataforma === "META");
      const totalLeads = agg?.totalLeads ?? 0;
      const totalCliques = agg?.totalCliques ?? 0;
      let conversao = totalCliques > 0 ? (totalLeads / totalCliques) * 100 : 0;
      conversao = Math.round(conversao * 100) / 100;
      return {
        id: c.id,
        nome: c.nome,
        slug: c.slug,
        logoUrl: c.logoUrl,
        segmento: c.segmento,
        ativo: c.ativo,
        squad: c.squad ?? null,
        totalLeads,
        conversao,
        totalCliques,
        hasGoogleConta,
        hasMetaConta,
      };
    });
    return NextResponse.json(withKpis);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/clientes] Erro:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
