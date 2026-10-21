"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, MetricTile, PillSelect, SegmentedControl, TextField } from "@/components/ui";
import Link from "next/link";
import { useCrmLinks } from "@/components/crm/CrmLinksContext";
import { Delta } from "@/components/atendimento/Delta";
import type { AtendimentoFinance } from "@/lib/atendimento/finance";
import type { FinanceRow } from "@/lib/atendimento/finance-view";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = (n: number) =>
  Math.abs(n) >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl(n);

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--foreground)",
    boxShadow: "none",
    padding: "10px 14px",
  },
};

const ROW_FILTERS = [
  { value: "", label: "Tudo" },
  { value: "income", label: "Entradas" },
  { value: "ads", label: "Custos de mídia" },
  { value: "expense", label: "Outras saídas" },
  { value: "refund", label: "Estornos" },
];

const KIND_LABEL: Record<FinanceRow["kind"], string> = {
  income: "Entrada",
  refund: "Estorno",
  expense: "Saída",
  ads: "Mídia",
};

function shortDay(ymd: string) {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

function ManualEntry({ workspaceId, onSaved }: { workspaceId: string; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const n = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return setError("Informe um valor maior que zero.");
    if (desc.trim().length < 2) return setError("Descreva o lançamento.");
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/atrako/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          type: kind,
          amount: n,
          source: "manual",
          description: desc.trim(),
          idempotencyKey: `manual:${workspaceId}:${Date.now()}`,
        }),
      });
      if (!r.ok) throw new Error("Não foi possível lançar.");
      setDesc("");
      setAmount("");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível lançar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="rel-card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <p className="type-caption-strong text-[var(--ink)]">Lançar no caixa</p>
        <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">Outros custos (comissão, ferramenta, evento) ou uma entrada fora do link</p>
      </div>
      <SegmentedControl
        value={kind}
        onChange={setKind}
        options={[
          { value: "EXPENSE", label: "Saída" },
          { value: "INCOME", label: "Entrada" },
        ]}
        aria-label="Tipo de lançamento"
      />
      <TextField label="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Comissão do consultor" />
      <TextField label="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
      {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
      <Button type="submit" variant="primary" size="toolbar" disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Lançar
      </Button>
    </form>
  );
}

export function FinanceiroPanel({
  workspaceId,
  query,
  periodLabel,
}: {
  workspaceId: string;
  query: string;
  periodLabel: string;
}) {
  const qc = useQueryClient();
  const links = useCrmLinks();
  const [rowFilter, setRowFilter] = useState("");
  const key = ["atendimento-finance", workspaceId, query];
  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/atendimento/finance?workspaceId=${encodeURIComponent(workspaceId)}&${query}`);
      if (!r.ok) throw new Error("fail");
      return (await r.json()) as AtendimentoFinance;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  if (isError) {
    return <div className="rel-card p-5 type-caption text-[var(--ink-muted-48)]">Não foi possível carregar o financeiro.</div>;
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rel-card p-5 type-caption text-[var(--ink-muted-48)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o financeiro…
      </div>
    );
  }

  const { totals, change, pending } = data;
  const rows = rowFilter ? data.rows.filter((r) => r.kind === rowFilter) : data.rows;
  const hasMovement = data.daily.some((d) => d.income !== 0 || d.costs !== 0);
  const chart = data.daily.map((d) => ({ dia: shortDay(d.date), Entradas: d.income, Custos: d.costs }));

  return (
    <div className={`caixa-shell transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
      <div className="caixa-kpi-grid">
        <div className="caixa-saldo-card">
          <p className="type-fine-print text-[var(--body-muted)]">Resultado · {periodLabel}</p>
          <p className="type-tagline tabular-nums text-[var(--on-dark)]">{brl(totals.net)}</p>
          <p className="type-fine-print text-[var(--body-muted)]">Entradas menos custos de mídia e saídas</p>
        </div>
        <MetricTile
          label="Entradas"
          value={brl(totals.income - totals.refund)}
          tone={totals.income > 0 ? "positive" : undefined}
          delta={<Delta value={change.income} />}
          detail={pending.count ? `${brl(pending.amount)} a receber em ${pending.count} ${pending.count === 1 ? "link" : "links"}` : undefined}
        />
        <MetricTile
          label="Custos"
          value={brl(totals.costs)}
          tone={totals.costs > 0 ? "negative" : undefined}
          delta={<Delta value={change.adSpend} invert />}
          detail={`${brl(totals.adSpend)} em mídia${totals.expense ? ` · ${brl(totals.expense)} outras` : ""}`}
        />
        <MetricTile
          label="Vendas"
          value={totals.sales.toLocaleString("pt-BR")}
          delta={<Delta value={change.sales} />}
          detail={
            [
              totals.roas != null ? `retorno ${totals.roas.toLocaleString("pt-BR")}x a mídia` : null,
              totals.costPerSale != null ? `${brl(totals.costPerSale)} de mídia por venda` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Negócios ganhos no período"
          }
        />
      </div>

      <section className="rel-card p-5">
        <p className="type-caption-strong text-[var(--ink)]">Entradas e custos por dia</p>
        <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">Pagamentos e negócios ganhos contra o investimento em anúncios e as saídas lançadas</p>
        {hasMovement ? (
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={64} tickFormatter={brlShort} />
                <Tooltip formatter={(v: number, name: string) => [brl(Number(v)), name]} {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Custos" fill="var(--chart-spend)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 type-fine-print text-[var(--ink-muted-48)]">Sem entradas ou custos no período</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rel-card p-5">
          <p className="type-caption-strong text-[var(--ink)]">Investimento por campanha</p>
          <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">Custo de mídia do período e leads gerados</p>
          {data.campaigns.length ? (
            <ul className="mt-4 divide-y divide-[var(--divider-soft)]">
              {data.campaigns.map((c) => (
                <li key={`${c.channel}-${c.name}`} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate type-caption text-[var(--ink)]">{c.name}</p>
                    <p className="type-micro-legal text-[var(--ink-muted-48)]">
                      {c.channel} · {c.leads.toLocaleString("pt-BR")} leads{c.leads ? ` · ${brl(c.spend / c.leads)} por lead` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 type-caption-strong tabular-nums text-[var(--ink)]">{brl(c.spend)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 type-fine-print text-[var(--ink-muted-48)]">Nenhum investimento em anúncios no período</p>
          )}
        </section>
        <ManualEntry workspaceId={workspaceId} onSaved={() => qc.invalidateQueries({ queryKey: key })} />
      </div>

      <section className="caixa-ledger">
        <div className="caixa-ledger-head flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-caption-strong text-[var(--ink)]">Extrato</h2>
          <PillSelect value={rowFilter} onChange={setRowFilter} options={ROW_FILTERS} aria-label="Tipo de lançamento" />
        </div>
        {rows.length === 0 ? (
          <div className="caixa-ledger-empty">
            <p className="type-caption text-[var(--ink-muted-48)]">Nenhum lançamento no período</p>
          </div>
        ) : (
          <ul className="caixa-ledger-list">
            {rows.map((r) => {
              const positive = r.kind === "income";
              return (
                <li key={r.id} className="caixa-ledger-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate type-caption-strong text-[var(--ink)]">{r.description}</p>
                      <span className="rounded-[var(--radius-xs)] bg-[var(--surface-chip-translucent)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-80)]">
                        {KIND_LABEL[r.kind]}
                      </span>
                    </div>
                    <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                      {new Date(`${r.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      {r.detail ? ` · ${r.detail}` : ""}
                      {r.leadId ? (
                        <>
                          {" · "}
                          <Link href={links.leadHref(r.leadId)} className="text-[var(--primary)]">
                            ver lead
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <p className={`shrink-0 type-caption-strong tabular-nums ${positive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {positive ? "+" : "−"}
                    {brl(r.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
