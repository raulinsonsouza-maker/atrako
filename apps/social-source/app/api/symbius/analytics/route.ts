import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { getActiveIgAccountId } from "@/lib/symbius/activeIgAccount";

export async function GET() {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const activeIg = await getActiveIgAccountId(session.organizationId);
  const orgFilter = { organizationId: session.organizationId };

  const [
    fluxos,
    execucoes,
    eventos,
    contatos,
    cliques,
  ] = await Promise.all([
    prisma.igFluxo.findMany({
      where: orgFilter,
      select: {
        id: true,
        nome: true,
        status: true,
        triggerType: true,
        _count: { select: { execucoes: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.igFluxoExecucao.count({ where: orgFilter }),
    prisma.igConversionEvent.groupBy({
      by: ["tipo"],
      where: orgFilter,
      _count: { tipo: true },
    }),
    prisma.igContato.count({
      where: {
        ...orgFilter,
        ...(activeIg ? { igAccountId: activeIg } : {}),
      },
    }),
    prisma.igConversionEvent.count({
      where: { ...orgFilter, tipo: "link_clicked" },
    }),
  ]);

  const eventMap = Object.fromEntries(
    eventos.map((e) => [e.tipo, e._count.tipo]),
  );

  return NextResponse.json({
    summary: {
      totalContatos: contatos,
      totalExecucoes: execucoes,
      linkClicks: cliques,
      emailsCapturados: eventMap.email_captured ?? 0,
      followsConfirmados: eventMap.follow_confirmed ?? 0,
      handoffs: eventMap.handoff ?? 0,
    },
    fluxos: fluxos.map((f) => ({
      id: f.id,
      nome: f.nome,
      status: f.status,
      triggerType: f.triggerType,
      execucoes: f._count.execucoes,
    })),
    eventos: eventMap,
  });
}
