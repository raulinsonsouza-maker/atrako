import { NextRequest, NextResponse } from "next/server";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { findFatosAnalyticsByClienteAndPeriod } from "@/lib/repositories/fatoAnalyticsRepository";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const periodo = request.nextUrl.searchParams.get("periodo") ?? "30";
  const dataInicioParam = request.nextUrl.searchParams.get("dataInicio");
  const dataFimParam = request.nextUrl.searchParams.get("dataFim");

  const diasFallback = Math.min(365, Math.max(7, parseInt(periodo, 10) || 30));
  const dataFim = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasFallback);

  const parseDateOnly = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    const parsed = new Date(y, m - 1, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  if (dataInicioParam && dataFimParam) {
    const parsedInicio = parseDateOnly(dataInicioParam);
    const parsedFim = parseDateOnly(dataFimParam);
    if (parsedInicio && parsedFim && parsedInicio <= parsedFim) {
      dataInicio.setTime(parsedInicio.getTime());
      dataFim.setTime(parsedFim.getTime());
      dataFim.setHours(23, 59, 59, 999);
    }
  }

  const cliente = await findClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const analyticsConta = await prisma.conta.findFirst({
    where: { clienteId: id, plataforma: "GOOGLE_ANALYTICS" },
  });

  if (!analyticsConta) {
    return NextResponse.json({
      clienteId: id,
      hasAnalytics: false,
      resumo: null,
      series: [],
    });
  }

  const fatos = await findFatosAnalyticsByClienteAndPeriod(id, dataInicio, dataFim);

  const totalSessions = fatos.reduce((s, f) => s + f.sessions, 0);
  const totalActiveUsers = fatos.reduce((s, f) => s + f.activeUsers, 0);
  const totalEngagedSessions = fatos.reduce((s, f) => s + f.engagedSessions, 0);
  const totalScreenPageViews = fatos.reduce((s, f) => s + f.screenPageViews, 0);
  const totalNewUsers = fatos.reduce((s, f) => s + f.newUsers, 0);

  const avgEngagementRate =
    fatos.length > 0
      ? fatos.reduce((s, f) => s + Number(f.engagementRate), 0) / fatos.length
      : 0;
  const avgBounceRate =
    fatos.length > 0 ? fatos.reduce((s, f) => s + Number(f.bounceRate), 0) / fatos.length : 0;
  const avgSessionDuration =
    fatos.length > 0
      ? fatos.reduce((s, f) => s + f.averageSessionDuration, 0) / fatos.length
      : 0;

  const diasSelecionados = Math.max(
    1,
    Math.floor((dataFim.getTime() - dataInicio.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  return NextResponse.json({
    clienteId: id,
    hasAnalytics: true,
    periodo: `${diasSelecionados} dias`,
    resumo: {
      sessions: totalSessions,
      activeUsers: totalActiveUsers,
      engagedSessions: totalEngagedSessions,
      engagementRate: Math.round(avgEngagementRate * 10000) / 10000,
      bounceRate: Math.round(avgBounceRate * 10000) / 10000,
      averageSessionDuration: Math.round(avgSessionDuration),
      newUsers: totalNewUsers,
      screenPageViews: totalScreenPageViews,
    },
    series: fatos.map((f) => ({
      data: f.data,
      sessions: f.sessions,
      activeUsers: f.activeUsers,
      engagedSessions: f.engagedSessions,
      engagementRate: Number(f.engagementRate),
      bounceRate: Number(f.bounceRate),
      averageSessionDuration: f.averageSessionDuration,
      newUsers: f.newUsers,
      screenPageViews: f.screenPageViews,
    })),
  });
}
