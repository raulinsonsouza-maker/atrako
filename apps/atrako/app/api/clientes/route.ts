import { NextResponse } from "next/server";
import { findAllClientes } from "@/lib/repositories/clientesRepository";
import { prisma } from "@/lib/db";
import { evaluateAccountHealthStatus } from "@/lib/account-health/status";
import { requireInternalAnalyst } from "@/lib/internalAccess";
import { getInternalUser } from "@/lib/internalUsers";
import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";
import { listMemberWorkspaceIds } from "@/lib/tenancy/workspace";

export async function GET() {
  const internal = await getInternalUser();
  const member = await getWorkspaceMember();
  let memberFilter: string[] | null = null;

  if (member && !(internal && internal.id !== "atrako-open-access")) {
    memberFilter = await listMemberWorkspaceIds(member.email);
  } else {
    const access = await requireInternalAnalyst();
    if (access.response) return access.response;
  }

  try {
    let clientes = await findAllClientes(true);
    if (memberFilter) {
      const set = new Set(memberFilter);
      clientes = clientes.filter((c) => set.has(c.id));
    }
    const ids = clientes.map((c) => c.id);
    if (ids.length === 0) {
      return NextResponse.json(
        clientes.map((c) => ({ ...c, totalLeads: 0, conversao: 0, squad: c.squad ?? null }))
      );
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenCompleteDaysStart = new Date(now);
    sevenCompleteDaysStart.setHours(0, 0, 0, 0);
    sevenCompleteDaysStart.setDate(sevenCompleteDaysStart.getDate() - 7);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [fatosRows, monthlySpendRows, last7MetaRows, latestDataRows, completeMonthRows] = await Promise.all([
      prisma.fatoMidiaDiario.groupBy({
        by: ["clienteId", "canal"],
        where: { clienteId: { in: ids } },
        _sum: { leads: true, conversoes: true, cliques: true },
      }),
      prisma.fatoMidiaDiario.groupBy({
        by: ["clienteId", "canal"],
        where: {
          clienteId: { in: ids },
          canal: { in: ["META", "GOOGLE"] },
          data: { gte: monthStart, lte: now },
        },
        _sum: { investimento: true },
      }),
      prisma.fatoMidiaDiario.groupBy({
        by: ["clienteId"],
        where: {
          clienteId: { in: ids },
          canal: "META",
          data: { gte: sevenCompleteDaysStart, lt: todayStart },
        },
        _sum: { investimento: true },
      }),
      prisma.fatoMidiaDiario.groupBy({
        by: ["clienteId", "canal"],
        where: {
          clienteId: { in: ids },
          canal: { in: ["META", "GOOGLE"] },
        },
        _max: { data: true },
      }),
      prisma.fatoMidiaDiario.groupBy({
        by: ["clienteId", "canal", "data"],
        where: {
          clienteId: { in: ids },
          canal: { in: ["META", "GOOGLE"] },
          data: { gte: monthStart, lt: todayStart },
        },
        _sum: { investimento: true },
      }),
    ]);
    const byCliente = new Map<string, { totalLeads: number; totalCliques: number }>();
    for (const r of fatosRows) {
      const cur = byCliente.get(r.clienteId) ?? { totalLeads: 0, totalCliques: 0 };
      cur.totalLeads += r.canal === "META"
        ? Number(r._sum.leads ?? 0)
        : Number(r._sum.conversoes ?? 0);
      cur.totalCliques += Number(r._sum.cliques ?? 0);
      byCliente.set(r.clienteId, cur);
    }
    const monthlySpend = new Map<string, { meta: number; google: number }>();
    for (const row of monthlySpendRows) {
      const current = monthlySpend.get(row.clienteId) ?? { meta: 0, google: 0 };
      if (row.canal === "META") current.meta = Number(row._sum.investimento ?? 0);
      if (row.canal === "GOOGLE") current.google = Number(row._sum.investimento ?? 0);
      monthlySpend.set(row.clienteId, current);
    }
    const last7MetaSpend = new Map(
      last7MetaRows.map((row) => [row.clienteId, Number(row._sum.investimento ?? 0)])
    );
    const latestData = new Map<string, { meta: Date | null; google: Date | null }>();
    for (const row of latestDataRows) {
      const current = latestData.get(row.clienteId) ?? { meta: null, google: null };
      if (row.canal === "META") current.meta = row._max.data;
      if (row.canal === "GOOGLE") current.google = row._max.data;
      latestData.set(row.clienteId, current);
    }
    const completeMonth = new Map<string, { spend: number; dates: Set<string> }>();
    for (const row of completeMonthRows) {
      const current = completeMonth.get(row.clienteId) ?? { spend: 0, dates: new Set<string>() };
      current.spend += Number(row._sum.investimento ?? 0);
      current.dates.add(row.data.toISOString().slice(0, 10));
      completeMonth.set(row.clienteId, current);
    }

    const withKpis = clientes.map((c) => {
      const agg = byCliente.get(c.id);
      const googleConta = c.contas.find((conta) => conta.plataforma === "GOOGLE_ADS");
      const metaConta = c.contas.find((conta) => conta.plataforma === "META");
      const hasGoogleConta = Boolean(googleConta?.accountIdPlataforma);
      const hasMetaConta = Boolean(metaConta?.accountIdPlataforma);
      const spend = monthlySpend.get(c.id) ?? { meta: 0, google: 0 };
      const latest = latestData.get(c.id) ?? { meta: null, google: null };
      const complete = completeMonth.get(c.id) ?? { spend: 0, dates: new Set<string>() };
      const monthlyBudgetMeta =
        c.orcamentoMidiaMetaMensal == null ? null : Number(c.orcamentoMidiaMetaMensal);
      const monthlyBudgetGoogle =
        c.orcamentoMidiaGoogleMensal == null ? null : Number(c.orcamentoMidiaGoogleMensal);
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
        healthStatus: evaluateAccountHealthStatus({
          now,
          hasMetaAccount: hasMetaConta,
          hasGoogleAccount: hasGoogleConta,
          latestMetaDataAt: latest.meta,
          latestGoogleDataAt: latest.google,
          metaPaymentMethod: c.formaPagamentoMeta,
          metaBalance: metaConta?.saldoAtual ?? null,
          metaBalanceUpdatedAt: metaConta?.saldoAtualizadoAt ?? null,
          monthlyBudgetMeta,
          monthlyBudgetGoogle,
          monthlySpendMeta: spend.meta,
          monthlySpendGoogle: spend.google,
          last7SpendMeta: last7MetaSpend.get(c.id) ?? 0,
          completeMonthSpend: complete.spend,
          completeMonthDataDays: complete.dates.size,
        }),
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
