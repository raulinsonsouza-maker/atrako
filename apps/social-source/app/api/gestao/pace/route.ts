import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const mesInicio = new Date(year, month, 1);
  const mesFim = new Date(year, month + 1, 0, 23, 59, 59);

  const diasNoMes = mesFim.getDate();
  const diasDecorridos = now.getDate();
  const expectedPacePct = (diasDecorridos / diasNoMes) * 100;

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      slug: true,
      logoUrl: true,
      segmento: true,
      orcamentoMidiaGoogleMensal: true,
      orcamentoMidiaMetaMensal: true,
    },
    orderBy: { nome: "asc" },
  });

  const fatos = await prisma.fatoMidiaDiario.groupBy({
    by: ["clienteId", "canal"],
    where: {
      data: { gte: mesInicio, lte: mesFim },
      canal: { in: ["META", "GOOGLE"] },
    },
    _sum: { investimento: true },
  });

  const spendMap = new Map<string, { meta: number; google: number }>();
  for (const f of fatos) {
    const entry = spendMap.get(f.clienteId) ?? { meta: 0, google: 0 };
    if (f.canal === "META") entry.meta = Number(f._sum.investimento ?? 0);
    if (f.canal === "GOOGLE") entry.google = Number(f._sum.investimento ?? 0);
    spendMap.set(f.clienteId, entry);
  }

  const todos = clientes.map((c) => {
    const spend = spendMap.get(c.id) ?? { meta: 0, google: 0 };
    const budgetMeta = c.orcamentoMidiaMetaMensal != null ? Number(c.orcamentoMidiaMetaMensal) : null;
    const budgetGoogle = c.orcamentoMidiaGoogleMensal != null ? Number(c.orcamentoMidiaGoogleMensal) : null;

    const expectedMeta = budgetMeta != null ? (budgetMeta * expectedPacePct) / 100 : null;
    const expectedGoogle = budgetGoogle != null ? (budgetGoogle * expectedPacePct) / 100 : null;

    const paceMeta =
      expectedMeta != null && expectedMeta > 0 ? (spend.meta / expectedMeta) * 100 : null;
    const paceGoogle =
      expectedGoogle != null && expectedGoogle > 0 ? (spend.google / expectedGoogle) * 100 : null;

    const budgetTotal = (budgetMeta ?? 0) + (budgetGoogle ?? 0);
    const spendTotal = spend.meta + spend.google;
    const expectedTotal = budgetTotal > 0 ? (budgetTotal * expectedPacePct) / 100 : 0;
    const paceTotal = budgetTotal > 0 && expectedTotal > 0 ? (spendTotal / expectedTotal) * 100 : null;

    const projecaoMeta =
      budgetMeta != null && diasDecorridos > 0
        ? (spend.meta / diasDecorridos) * diasNoMes
        : null;
    const projecaoGoogle =
      budgetGoogle != null && diasDecorridos > 0
        ? (spend.google / diasDecorridos) * diasNoMes
        : null;
    const projecaoTotal =
      budgetTotal > 0 && diasDecorridos > 0
        ? (spendTotal / diasDecorridos) * diasNoMes
        : null;

    return {
      id: c.id,
      nome: c.nome,
      slug: c.slug,
      logoUrl: c.logoUrl,
      segmento: c.segmento,
      budgetMeta,
      budgetGoogle,
      spendMeta: spend.meta,
      spendGoogle: spend.google,
      paceMeta,
      paceGoogle,
      paceTotal,
      projecaoMeta,
      projecaoGoogle,
      projecaoTotal,
      hasBudget: budgetMeta != null || budgetGoogle != null,
    };
  });

  const comOrcamento = todos.filter((c) => c.hasBudget);
  const semOrcamento = todos
    .filter((c) => !c.hasBudget)
    .map(({ id, nome, slug, logoUrl, segmento }) => ({ id, nome, slug, logoUrl, segmento }));

  const mesLabel = `${String(month + 1).padStart(2, "0")}/${year}`;

  return NextResponse.json({
    diasNoMes,
    diasDecorridos,
    expectedPacePct,
    mes: mesLabel,
    clientes: comOrcamento,
    semOrcamento,
  });
}
