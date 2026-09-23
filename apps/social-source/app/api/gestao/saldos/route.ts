import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { fetchAccountBalance } from "@/lib/meta/metaClient";

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

  const contasMeta = await prisma.conta.findMany({
    where: { plataforma: "META", accountIdPlataforma: { not: null } },
    include: {
      cliente: {
        select: { id: true, nome: true, slug: true, logoUrl: true, ativo: true },
      },
    },
  });

  const ativas = contasMeta.filter((c) => c.cliente.ativo && c.accountIdPlataforma);

  const now = new Date();
  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 7);

  const fatosUlt7 = await prisma.fatoMidiaDiario.groupBy({
    by: ["clienteId"],
    where: {
      canal: "META",
      data: { gte: last7, lte: now },
    },
    _sum: { investimento: true },
  });

  const burnMap = new Map<string, number>();
  for (const f of fatosUlt7) {
    burnMap.set(f.clienteId, Number(f._sum.investimento ?? 0) / 7);
  }

  const config = await getIntegrationsConfig();
  const metaToken = config.metaAccessToken;

  const settled = await Promise.allSettled(
    ativas.map(async (conta) => {
      const accountId = conta.accountIdPlataforma!;
      const cid = conta.clienteId;
      const burnDiario = burnMap.get(cid) ?? 0;

      if (!metaToken) {
        return {
          clienteId: cid,
          nome: conta.cliente.nome,
          slug: conta.cliente.slug,
          logoUrl: conta.cliente.logoUrl,
          accountId,
          saldo: null as number | null,
          moeda: "BRL",
          burnDiario7d: burnDiario,
          diasRestantes: null as number | null,
          erro: "Token Meta não configurado",
        };
      }

      const balance = await fetchAccountBalance(accountId, metaToken);
      const saldoVal = balance.balance;
      const diasRestantes = saldoVal != null && burnDiario > 0 ? saldoVal / burnDiario : null;

      return {
        clienteId: cid,
        nome: conta.cliente.nome,
        slug: conta.cliente.slug,
        logoUrl: conta.cliente.logoUrl,
        accountId,
        saldo: saldoVal,
        moeda: balance.currency,
        burnDiario7d: burnDiario,
        diasRestantes,
        erro: null as string | null,
      };
    })
  );

  const contas = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const conta = ativas[i];
    return {
      clienteId: conta.clienteId,
      nome: conta.cliente.nome,
      slug: conta.cliente.slug,
      logoUrl: conta.cliente.logoUrl,
      accountId: conta.accountIdPlataforma,
      saldo: null as number | null,
      moeda: "BRL",
      burnDiario7d: burnMap.get(conta.clienteId) ?? 0,
      diasRestantes: null as number | null,
      erro: r.reason instanceof Error ? r.reason.message : "Erro ao buscar saldo",
    };
  });

  contas.sort((a, b) => {
    if (a.diasRestantes === null && b.diasRestantes === null) return 0;
    if (a.diasRestantes === null) return 1;
    if (b.diasRestantes === null) return -1;
    return a.diasRestantes - b.diasRestantes;
  });

  return NextResponse.json({ contas });
}
