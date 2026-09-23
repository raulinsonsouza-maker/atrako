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

  const clientes = await prisma.cliente.findMany({
    select: {
      id: true,
      nome: true,
      slug: true,
      logoUrl: true,
      ativo: true,
      gestor: true,
      formaPagamentoMeta: true,
      formaPagamentoGoogle: true,
      orcamentoMidiaMetaMensal: true,
      orcamentoMidiaGoogleMensal: true,
      contas: {
        select: {
          plataforma: true,
          accountIdPlataforma: true,
          googleAdsLoginCustomerId: true,
        },
      },
    },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });

  const now = new Date();
  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const gastosMes = await prisma.fatoMidiaDiario.groupBy({
    by: ["clienteId", "canal"],
    where: {
      canal: { in: ["META", "GOOGLE"] },
      data: { gte: mesInicio, lte: mesFim },
    },
    _sum: { investimento: true },
  });

  const gastoMap = new Map<string, { meta: number; google: number }>();
  for (const g of gastosMes) {
    const entry = gastoMap.get(g.clienteId) ?? { meta: 0, google: 0 };
    if (g.canal === "META") entry.meta = Number(g._sum.investimento ?? 0);
    if (g.canal === "GOOGLE") entry.google = Number(g._sum.investimento ?? 0);
    gastoMap.set(g.clienteId, entry);
  }

  const config = await getIntegrationsConfig();
  const metaToken = config.metaAccessToken;

  const rows = await Promise.all(
    clientes.map(async (c) => {
      const orcMeta = c.orcamentoMidiaMetaMensal != null ? Number(c.orcamentoMidiaMetaMensal) : null;
      const orcGoogle = c.orcamentoMidiaGoogleMensal != null ? Number(c.orcamentoMidiaGoogleMensal) : null;
      const gasto = gastoMap.get(c.id) ?? { meta: 0, google: 0 };

      const contaMeta = c.contas.find((ct) => ct.plataforma === "META");

      let saldoMeta: number | null = null;
      if (metaToken && contaMeta?.accountIdPlataforma) {
        try {
          const bal = await fetchAccountBalance(contaMeta.accountIdPlataforma, metaToken);
          saldoMeta = bal.balance;
        } catch {
          saldoMeta = null;
        }
      }

      let saldoGoogle: number | null = null;
      if (orcGoogle != null && orcGoogle > 0) {
        saldoGoogle = Math.max(0, orcGoogle - gasto.google);
      }

      return {
        id: c.id,
        nome: c.nome,
        slug: c.slug,
        logoUrl: c.logoUrl,
        ativo: c.ativo,
        gestor: c.gestor,
        formaPagamentoMeta: c.formaPagamentoMeta,
        formaPagamentoGoogle: c.formaPagamentoGoogle,
        orcamentoMeta: orcMeta,
        orcamentoGoogle: orcGoogle,
        orcamentoTotal: (orcMeta ?? 0) + (orcGoogle ?? 0),
        saldoMeta,
        saldoGoogle,
        gastoMeta: gasto.meta,
        gastoGoogle: gasto.google,
      };
    })
  );

  return NextResponse.json({ rows });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id: string;
    gestor?: string | null;
    formaPagamentoMeta?: string | null;
    formaPagamentoGoogle?: string | null;
    orcamentoMeta?: number | null;
    orcamentoGoogle?: number | null;
    ativo?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("gestor" in body) data.gestor = body.gestor ?? null;
  if ("formaPagamentoMeta" in body) data.formaPagamentoMeta = body.formaPagamentoMeta ?? null;
  if ("formaPagamentoGoogle" in body) data.formaPagamentoGoogle = body.formaPagamentoGoogle ?? null;
  if ("orcamentoMeta" in body) data.orcamentoMidiaMetaMensal = body.orcamentoMeta ?? null;
  if ("orcamentoGoogle" in body) data.orcamentoMidiaGoogleMensal = body.orcamentoGoogle ?? null;
  if ("ativo" in body) data.ativo = body.ativo;

  await prisma.cliente.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true });
}
