import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { getCrmFilters, buildTagFilterWhere, buildJsonStringFilterWhere } from "@/lib/crm/tagFilter";
import { buildLeadFilterWhere, buildPaidMediaWhere } from "@/lib/crm/canalFilter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = request.nextUrl;

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "15", 10)));
  const search = url.searchParams.get("search")?.trim() ?? "";

  const filterType  = url.searchParams.get("filterType");
  const filterValue = url.searchParams.get("filterValue");
  const paidOnly = url.searchParams.get("paidOnly") === "1";
  const filterCondition = buildLeadFilterWhere(filterType, filterValue);

  // Support both ?from=YYYY-MM-DD&to=YYYY-MM-DD and legacy ?period= param
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (fromParam) {
    dateFrom = new Date(fromParam);
  } else {
    // Legacy period support
    const period = url.searchParams.get("period") ?? "all";
    const now = new Date();
    if (period === "month") dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === "3months") {
      const d = new Date(); d.setMonth(d.getMonth() - 3); dateFrom = d;
    } else if (period === "ytd") dateFrom = new Date(now.getFullYear(), 0, 1);
  }

  if (toParam) {
    dateTo = new Date(toParam);
    // Include the full end day
    dateTo.setHours(23, 59, 59, 999);
  }

  const crmFilters = await getCrmFilters(id);
  const { tagFilter, conversaoOriginalFilter, conversaoUltimoFilter, midiaFilter, origemOriginalFilter, origemUltimoFilter } = crmFilters;

  const andClauses: Prisma.LeadCrmWhereInput[] = [
    ...(paidOnly ? [buildPaidMediaWhere()] : []),
    ...(tagFilter.length > 0 ? [buildTagFilterWhere(tagFilter)] : []),
    ...(conversaoOriginalFilter.length > 0 ? [buildJsonStringFilterWhere("conversaoOriginal", conversaoOriginalFilter)] : []),
    ...(conversaoUltimoFilter.length > 0 ? [buildJsonStringFilterWhere("conversaoUltimo", conversaoUltimoFilter)] : []),
    ...(midiaFilter.length > 0 ? [buildJsonStringFilterWhere("midiaOriginal", midiaFilter)] : []),
    ...(origemOriginalFilter.length > 0 ? [buildJsonStringFilterWhere("origem", origemOriginalFilter)] : []),
    ...(origemUltimoFilter.length > 0 ? [buildJsonStringFilterWhere("origemUltimo", origemUltimoFilter)] : []),
    ...(filterCondition && Object.keys(filterCondition).length > 0 ? [filterCondition] : []),
  ];

  const where: Prisma.LeadCrmWhereInput = {
    clienteId: id,
    ...(dateFrom || dateTo
      ? {
          dataEntrada: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { nome: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { telefone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.leadCrm.findMany({
      where,
      select: {
        id: true,
        crmLeadId: true,
        etapa: true,
        valor: true,
        dataEntrada: true,
        dataFechamento: true,
        nome: true,
        email: true,
        telefone: true,
        fonte: true,
        rating: true,
        status: true,
        momentoLead: true,
        dadosMarketing: true,
        dadosCv: true,
      },
      orderBy: { dataEntrada: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leadCrm.count({ where }),
  ]);

  return NextResponse.json({
    leads: leads.map((l) => ({
      id: l.id,
      crmLeadId: l.crmLeadId,
      etapa: l.etapa,
      valor: l.valor ? Number(l.valor) : null,
      dataEntrada: l.dataEntrada,
      dataFechamento: l.dataFechamento ?? null,
      nome: l.nome ?? null,
      email: l.email ?? null,
      telefone: l.telefone ?? null,
      fonte: l.fonte ?? null,
      rating: l.rating ?? null,
      status: l.status ?? null,
      momentoLead: l.momentoLead ?? null,
      dadosMarketing: l.dadosMarketing ?? null,
      dadosCv: l.dadosCv ?? null,
    })),
    total,
    page,
    pageSize,
  });
}

/** Bridge Symbius Flow → Central LeadCrm */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clienteId } = await params;
  const internal = request.headers.get("x-internal-key");
  const expected = process.env.SYMBIUS_INTERNAL_API_KEY;
  if (expected && internal !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    source?: string;
    email?: string;
    phone?: string;
    name?: string;
    tags?: string[];
    stId?: string;
    valor?: number;
    dadosMarketing?: Record<string, unknown>;
    transactionId?: string;
  };

  const crmConfig = await prisma.crmConfig.findFirst({
    where: { clienteId, ativo: true },
  });
  if (!crmConfig) {
    return NextResponse.json(
      { error: "CRM não configurado para este cliente" },
      { status: 404 },
    );
  }

  const crmLeadId =
    body.stId ||
    body.transactionId ||
    `symbius_${body.email || body.phone || Date.now()}`;

  const dadosMarketing = {
    ...(body.dadosMarketing ?? {}),
    source: body.source ?? "symbius_flow",
    tags: body.tags,
    stId: body.stId,
    transactionId: body.transactionId,
  };

  const lead = await prisma.leadCrm.upsert({
    where: {
      clienteId_crmLeadId: { clienteId, crmLeadId },
    },
    create: {
      clienteId,
      crmConfigId: crmConfig.id,
      crmLeadId,
      etapa: body.transactionId ? "Ganho" : "Lead",
      nome: body.name,
      email: body.email,
      telefone: body.phone,
      fonte: "symbius_flow",
      dataEntrada: new Date(),
      valor: body.valor ?? null,
      dadosMarketing,
      momentoLead: body.transactionId ? "cliente" : "lead",
    },
    update: {
      nome: body.name ?? undefined,
      email: body.email ?? undefined,
      telefone: body.phone ?? undefined,
      valor: body.valor ?? undefined,
      dadosMarketing,
      ...(body.transactionId
        ? { etapa: "Ganho", momentoLead: "cliente", dataFechamento: new Date() }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, id: lead.id, crmLeadId: lead.crmLeadId });
}
