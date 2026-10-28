"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricGrid, MetricTile, SectionCard } from "@/components/ui";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatCompactNumber, mobileTickInterval } from "@/lib/chart-mobile";

export type PlanoRealMes = {
  ano: number;
  mes: number;
  planejadoTotal: number;
  realizadoTotal: number;
};

export type PlanoRealData = {
  meses: PlanoRealMes[];
  totalPlanejado?: number;
  totalRealizado?: number;
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--foreground)",
    boxShadow: "none",
    padding: "10px 14px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Ano de mídia: orçado contra realizado. Sem orçamento, só o realizado mês a mês. */
export function PlanoRealCard({
  financeiro,
  scope = "all",
}: {
  financeiro: PlanoRealData;
  /** `meta` fala da conta de anúncios; `all` mantém o texto do dashboard geral. */
  scope?: "all" | "meta";
}) {
  const isMobile = useIsMobile();
  const semOrcamento = Number(financeiro.totalPlanejado ?? 0) <= 0;
  const place = scope === "meta" ? "na Meta" : "em todos os canais";
  const placeShort = scope === "meta" ? "na Meta" : "todos os canais";

  return (
    <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="type-tagline text-[var(--foreground)]">
              {semOrcamento ? "Investimento por mês" : "Acompanhamento financeiro · Plano x Real"}
            </h2>
            <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
              {semOrcamento
                ? `Quanto foi investido em mídia em cada mês do ano (${placeShort})`
                : `Status de investimento no ano atual (planejado versus realizado ${place})`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!semOrcamento && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-muted/30 px-3 py-1.5 type-fine-print">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-plan)]" />
                <span className="text-[var(--muted-foreground)]">Orçado</span>
                <strong className="text-[var(--foreground)]">
                  {formatCurrency(Number(financeiro.totalPlanejado ?? 0))}
                </strong>
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 type-fine-print">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
              <span className="text-[var(--muted-foreground)]">Realizado</span>
              <strong className="text-[var(--primary)]">
                {formatCurrency(Number(financeiro.totalRealizado ?? 0))}
              </strong>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={financeiro.meses.map((m) => ({
                mes: new Date(m.ano, m.mes - 1, 1).toLocaleString("pt-BR", { month: "short" }).toUpperCase(),
                Orcado: m.planejadoTotal,
                Realizado: m.realizadoTotal,
              }))}
            >
              <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
              <XAxis
                dataKey="mes"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={isMobile ? mobileTickInterval(financeiro.meses.length) : undefined}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={isMobile ? 44 : 60}
                tickFormatter={(value) => (isMobile ? formatCompactNumber(Number(value)) : formatCurrency(Number(value)))}
              />
              <Tooltip formatter={(value: number, name: string) => [formatCurrency(Number(value)), name]} {...tooltipStyle} />
              {!semOrcamento && <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />}
              {!semOrcamento && <Bar dataKey="Orcado" name="Orçado" fill="var(--chart-plan)" radius={[6, 6, 0, 0]} />}
              <Bar dataKey="Realizado" fill="var(--chart-result)" radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <PaceDoMes meses={financeiro.meses} />
      </CardContent>
    </Card>
  );
}

function PaceDoMes({ meses }: { meses: PlanoRealMes[] }) {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const cmd = meses.find((m) => m.mes === currentMonth && m.ano === currentYear);
  if (!cmd || cmd.planejadoTotal <= 0) return null;
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const dayOfMonth = today.getDate();
  const paceIdeal = (cmd.planejadoTotal / daysInMonth) * dayOfMonth;
  const delta = cmd.realizadoTotal - paceIdeal;
  const deltaPercent = paceIdeal > 0 ? (delta / paceIdeal) * 100 : 0;
  const isAhead = delta >= 0;
  const pctRealizado = Math.min(100, (cmd.realizadoTotal / cmd.planejadoTotal) * 100);
  const pctEsperado = Math.min(100, (paceIdeal / cmd.planejadoTotal) * 100);
  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleString("pt-BR", { month: "long" });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <SectionCard
      className="mt-5"
      title={`Ritmo do mês · ${monthLabel} — dia ${dayOfMonth} de ${daysInMonth}`}
      action={
        <span className={`inline-flex items-center gap-1 type-caption-strong ${isAhead ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {isAhead ? "▲" : "▼"} {Math.abs(deltaPercent).toFixed(1)}% {isAhead ? "acima do ritmo" : "abaixo do ritmo"}
        </span>
      }
    >
      <MetricGrid>
        <MetricTile label="Orçado no mês" value={formatCurrency(cmd.planejadoTotal)} />
        <MetricTile label="Realizado até hoje" value={formatCurrency(cmd.realizadoTotal)} />
        <MetricTile label={`Ritmo esperado (dia ${dayOfMonth})`} value={formatCurrency(paceIdeal)} />
        <MetricTile
          label="Diferença do ritmo"
          value={`${isAhead ? "+" : ""}${formatCurrency(delta)}`}
          tone={isAhead ? "positive" : "negative"}
        />
      </MetricGrid>
      <div className="mt-3 relative h-2 overflow-hidden rounded-full bg-[var(--border)]">
        <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink-muted-48)] z-10" style={{ left: `${pctEsperado}%` }} />
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${isAhead ? "bg-[var(--positive)]" : "bg-[var(--primary)]"}`}
          style={{ width: `${pctRealizado}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 type-micro-legal text-[var(--muted-foreground)]">
        <span>{pctRealizado.toFixed(0)}% realizado do mês</span>
        <span className="text-[var(--border)]">|</span>
        <span>Ritmo esperado: {pctEsperado.toFixed(0)}%</span>
        <span className="text-[var(--border)]">|</span>
        <span>{(100 - pctRealizado).toFixed(0)}% restante para fechar o mês</span>
      </div>
    </SectionCard>
  );
}
