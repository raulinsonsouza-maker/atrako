"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { getReportCharts } from "@/server/actions/dashboard";
import { DashboardCharts } from "./DashboardCharts";

const PERIODS = [7, 30, 90] as const;

export function ReportsView({ tenantId }: { tenantId: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Awaited<ReturnType<typeof getReportCharts>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getReportCharts(tenantId, days);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [tenantId, days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-neutral-900">Relatórios</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600">Período:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {PERIODS.map((d) => (
              <option key={d} value={d}>Últimos {d} dias</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-error-600">{error}</p>
      )}

      {loading ? (
        <p className="text-neutral-500">Carregando…</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Leads (período)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{data.totais.novos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Em atendimento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{data.totais.emAtendimento}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Convertidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-primary-600">{data.totais.convertidos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Perdidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{data.totais.perdidos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Taxa de conversão</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {data.totais.taxaConversao != null ? `${data.totais.taxaConversao}%` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Ticket médio (ganhos)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {data.totais.ticketMedio != null ? `R$ ${data.totais.ticketMedio.toFixed(2).replace(".", ",")}` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Receita (vendas, período)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-primary-600 dark:text-primary-400">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.totais.receita)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Recompra (≥2 vendas)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{data.totais.recompra}</p>
              </CardContent>
            </Card>
            {data.totais.tempoMedioFechamento != null && data.totais.tempoMedioFechamento > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Tempo médio de fechamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {data.totais.tempoMedioFechamento} {data.totais.tempoMedioFechamento === 1 ? "dia" : "dias"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          {data.totais.taxaResposta != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Taxa de resposta (conversas com ≥1 envio)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{data.totais.taxaResposta}%</p>
              </CardContent>
            </Card>
          )}
          {data.totais.tempoMedioPorEtapa && data.totais.tempoMedioPorEtapa.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Tempo médio por etapa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.totais.tempoMedioPorEtapa.map((item: { stageName: string; averageDays: number; sampleSize: number }) => (
                    <div key={item.stageName} className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.stageName}</span>
                      <div className="text-right">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {item.averageDays} {item.averageDays === 1 ? "dia" : "dias"}
                        </span>
                        <span className="ml-2 text-xs text-neutral-500">({item.sampleSize} amostras)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <DashboardCharts bySource={data.bySource} byStage={data.byStage} />
        </>
      ) : null}
    </div>
  );
}
