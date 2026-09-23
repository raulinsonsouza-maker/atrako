import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canalParam = request.nextUrl.searchParams.get("canal") ?? "geral";
  const canal = canalParam.toLowerCase() as "geral" | "google" | "meta";

  const cliente = await prisma.cliente.findUnique({
    where: { id },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const anoAtual = new Date().getFullYear();
  const dataInicio = new Date(anoAtual, 0, 1, 0, 0, 0, 0);
  const dataFim = new Date(anoAtual, 11, 31, 23, 59, 59, 999);

  const fatos = await prisma.fatoMidiaDiario.findMany({
    where: {
      clienteId: id,
      data: { gte: dataInicio, lte: dataFim },
      canal:
        canal === "geral"
          ? { in: ["GOOGLE", "META"] }
          : canal === "google"
            ? "GOOGLE"
            : "META",
    },
    select: {
      data: true,
      canal: true,
      investimento: true,
    },
    orderBy: { data: "asc" },
  });

  const meses = Array.from({ length: 12 }, (_, i) => ({
    ano: anoAtual,
    mes: i + 1,
    key: `${anoAtual}-${i + 1}`,
  }));

  const grouped = new Map<string, { realizadoGoogle: number; realizadoMeta: number }>();
  for (const f of fatos) {
    const d = new Date(f.data);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const prev = grouped.get(key) ?? { realizadoGoogle: 0, realizadoMeta: 0 };
    const valor = Number(f.investimento);
    if (f.canal === "GOOGLE") prev.realizadoGoogle += valor;
    if (f.canal === "META") prev.realizadoMeta += valor;
    grouped.set(key, prev);
  }

  const orcGoogle = cliente.orcamentoMidiaGoogleMensal
    ? Number(cliente.orcamentoMidiaGoogleMensal)
    : 0;
  const orcMeta = cliente.orcamentoMidiaMetaMensal
    ? Number(cliente.orcamentoMidiaMetaMensal)
    : 0;

  const rows = meses.map(({ ano, mes, key }) => {
    const realizadoGoogle = grouped.get(key)?.realizadoGoogle ?? 0;
    const realizadoMeta = grouped.get(key)?.realizadoMeta ?? 0;
    const realizadoTotal =
      canal === "google"
        ? realizadoGoogle
        : canal === "meta"
          ? realizadoMeta
          : realizadoGoogle + realizadoMeta;

    const planejadoTotal =
      canal === "google" ? orcGoogle : canal === "meta" ? orcMeta : orcGoogle + orcMeta;

    return {
      ano,
      mes,
      planejadoTotal,
      realizadoTotal,
      realizadoGoogle,
      realizadoMeta,
    };
  });

  const totalPlanejado = rows.reduce((acc, r) => acc + r.planejadoTotal, 0);
  const totalRealizado = rows.reduce((acc, r) => acc + r.realizadoTotal, 0);

  return NextResponse.json({
    clienteId: id,
    canal,
    periodo: `Ano ${anoAtual}`,
    ano: anoAtual,
    dataInicio,
    dataFim,
    totalPlanejado,
    totalRealizado,
    meses: rows,
  });
}

