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
  const day9 = new Date(now);
  day9.setDate(day9.getDate() - 9);
  day9.setHours(0, 0, 0, 0);

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, slug: true, logoUrl: true },
  });
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  const fatos = await prisma.fatoMidiaDiario.findMany({
    where: {
      data: { gte: day9, lte: now },
      canal: { in: ["META", "GOOGLE"] },
      clienteId: { in: clientes.map((c) => c.id) },
    },
    select: { clienteId: true, canal: true, data: true, investimento: true },
    orderBy: { data: "asc" },
  });

  type DaySpend = { data: Date; spend: number };
  const grouped = new Map<string, DaySpend[]>();
  for (const f of fatos) {
    const key = `${f.clienteId}__${f.canal}`;
    const entry = grouped.get(key) ?? [];
    entry.push({ data: new Date(f.data), spend: Number(f.investimento) });
    grouped.set(key, entry);
  }

  const cutoff2 = new Date(now);
  cutoff2.setDate(cutoff2.getDate() - 1);
  cutoff2.setHours(0, 0, 0, 0);

  const anomalias: Array<{
    clienteId: string;
    nome: string;
    slug: string;
    logoUrl: string | null;
    canal: string;
    ultimoGastoData: string;
    diasSemGasto: number;
  }> = [];

  for (const [key, days] of grouped.entries()) {
    const [clienteId, canal] = key.split("__");
    const cliente = clienteMap.get(clienteId);
    if (!cliente) continue;

    const spendUlt2 = days
      .filter((d) => d.data >= cutoff2)
      .reduce((s, d) => s + d.spend, 0);

    const spendAnterior = days
      .filter((d) => d.data < cutoff2 && d.data >= day9)
      .reduce((s, d) => s + d.spend, 0);

    if (spendAnterior > 0 && spendUlt2 === 0) {
      const withSpend = days
        .filter((d) => d.spend > 0)
        .sort((a, b) => b.data.getTime() - a.data.getTime());
      if (withSpend.length === 0) continue;
      const lastDate = withSpend[0].data;
      const diasSemGasto = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      anomalias.push({
        clienteId,
        nome: cliente.nome,
        slug: cliente.slug,
        logoUrl: cliente.logoUrl,
        canal,
        ultimoGastoData: lastDate.toISOString().slice(0, 10),
        diasSemGasto,
      });
    }
  }

  anomalias.sort((a, b) => b.diasSemGasto - a.diasSemGasto);

  return NextResponse.json({ anomalias });
}
