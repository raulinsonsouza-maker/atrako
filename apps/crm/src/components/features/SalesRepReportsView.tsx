"use client";

import { useState, useEffect } from "react";
import {
  getAllSalesRepsPerformance,
  getSalesRepPerformance,
  getSalesRepLeadsByStage,
  getSalesRepLeadsBySource,
} from "@/server/actions/salesReports";
import { listUsers } from "@/server/actions/lead";
import { Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface PerformanceData {
  user: { id: string; name: string; email: string };
  leads: {
    thisMonth: number;
    lastMonth: number;
    change: number;
    won: number;
    inProgress: number;
    total: number;
  };
  opportunities: {
    thisMonth: number;
    won: number;
    lost: number;
    open: number;
  };
  sales: {
    thisMonth: number;
    lastMonth: number;
    revenue: number;
    revenueChange: number;
    avgTicket: number;
  };
  conversion: {
    rate: number;
    change: number;
  };
}

export function SalesRepReportsView({ tenantId }: { tenantId: string }) {
  const [performances, setPerformances] = useState<PerformanceData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [perfs, usrs] = await Promise.all([
        getAllSalesRepsPerformance(tenantId),
        listUsers(tenantId),
      ]);
      setPerformances(perfs);
      setUsers(usrs);
      if (perfs.length > 0 && !selectedUserId) {
        setSelectedUserId(perfs[0].user.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-neutral-500">Carregando relatórios…</p>;
  if (error) return <p className="text-error-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Performance por Vendedor</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Métricas individuais de cada membro da equipe</p>
      </div>

      {/* Lista de vendedores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {performances.map((perf) => (
          <Card
            key={perf.user.id}
            className={`cursor-pointer transition-all ${
              selectedUserId === perf.user.id
                ? "ring-2 ring-primary-500"
                : "hover:shadow-md"
            }`}
            onClick={() => setSelectedUserId(perf.user.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{perf.user.name}</p>
                  <p className="text-xs text-neutral-500">{perf.user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary-600">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: 0,
                    }).format(perf.sales.revenue)}
                  </p>
                  <p className="text-xs text-neutral-500">Este mês</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-neutral-500">{perf.leads.thisMonth} leads</span>
                <span className="text-neutral-500">{perf.conversion.rate}% conversão</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detalhes do vendedor selecionado */}
      {selectedUserId && (
        <SalesRepDetailView tenantId={tenantId} userId={selectedUserId} />
      )}
    </div>
  );
}

function SalesRepDetailView({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [byStage, setByStage] = useState<Array<{ stageId: string | null; stageName: string; color: string; count: number }>>([]);
  const [bySource, setBySource] = useState<Array<{ source: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tenantId, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [perf, stages, sources] = await Promise.all([
        getSalesRepPerformance(tenantId, userId),
        getSalesRepLeadsByStage(tenantId, userId),
        getSalesRepLeadsBySource(tenantId, userId),
      ]);
      setPerformance(perf as PerformanceData);
      setByStage(stages);
      setBySource(sources);
    } catch (e) {
      console.error("Erro ao carregar detalhes:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !performance) return <p className="text-neutral-500">Carregando detalhes…</p>;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Detalhes - {performance.user.name}
      </h3>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(performance.sales.revenue)}
            </p>
            {performance.sales.revenueChange !== 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {performance.sales.revenueChange > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-success-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-error-500" />
                )}
                <span
                  className={
                    performance.sales.revenueChange > 0 ? "text-success-600" : "text-error-600"
                  }
                >
                  {performance.sales.revenueChange > 0 ? "+" : ""}
                  {performance.sales.revenueChange}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
              {performance.leads.thisMonth}
            </p>
            {performance.leads.change !== 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {performance.leads.change > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-success-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-error-500" />
                )}
                <span
                  className={
                    performance.leads.change > 0 ? "text-success-600" : "text-error-600"
                  }
                >
                  {performance.leads.change > 0 ? "+" : ""}
                  {performance.leads.change}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
              {performance.conversion.rate}%
            </p>
            {performance.conversion.change !== 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {performance.conversion.change > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-success-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-error-500" />
                )}
                <span
                  className={
                    performance.conversion.change > 0 ? "text-success-600" : "text-error-600"
                  }
                >
                  {performance.conversion.change > 0 ? "+" : ""}
                  {performance.conversion.change}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(performance.sales.avgTicket)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Leads por Estágio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byStage.map((item) => (
                <div key={item.stageId || "null"} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {item.stageName}
                    </span>
                  </div>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bySource.map((item) => (
                <div key={item.source} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.source}</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
