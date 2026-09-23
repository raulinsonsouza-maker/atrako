import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { getISOWeek, getYear } from "date-fns";

const PRIORIDADE_ORDER: Record<string, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cliente = await findClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const pautas = await prisma.pautaReuniao.findMany({
    where: { clienteId: id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const sorted = pautas.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "ABERTA") return -1;
      if (b.status === "ABERTA") return 1;
    }
    const pa = PRIORIDADE_ORDER[a.prioridade] ?? 1;
    const pb = PRIORIDADE_ORDER[b.prioridade] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.dataFim && b.dataFim) return a.dataFim.getTime() - b.dataFim.getTime();
    if (a.dataFim) return -1;
    if (b.dataFim) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return NextResponse.json(sorted);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cliente = await findClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  let body: {
    titulo?: string;
    descricao?: string;
    semanaIso?: number;
    ano?: number;
    prioridade?: string;
    dataFim?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const titulo = body.titulo?.trim();
  if (!titulo) {
    return NextResponse.json({ error: "titulo é obrigatório" }, { status: 400 });
  }
  const ano = body.ano ?? getYear(new Date());
  const semanaIso = body.semanaIso ?? getISOWeek(new Date());
  const prioridade = ["ALTA", "MEDIA", "BAIXA"].includes(body.prioridade ?? "")
    ? body.prioridade!
    : "MEDIA";
  const dataFim = body.dataFim ? new Date(body.dataFim) : null;

  const pauta = await prisma.pautaReuniao.create({
    data: {
      clienteId: id,
      ano,
      semanaIso,
      titulo,
      descricao: body.descricao?.trim() ?? null,
      status: "ABERTA",
      prioridade,
      dataFim,
    },
  });
  return NextResponse.json(pauta);
}
