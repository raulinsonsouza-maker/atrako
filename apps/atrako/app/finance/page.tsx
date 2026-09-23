"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, RefreshCcw } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";

type Cliente = { id: string; nome: string };
type Entry = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  occurredAt: string;
  source: string;
  description: string | null;
  provider: string | null;
  leadId?: string | null;
  contact?: string | null;
  pageSlug?: string | null;
  formName?: string | null;
  metadata?: Record<string, unknown> | null;
};

const SOURCE_LABELS: Record<string, string> = {
  commerce: "Vendas",
  manual: "Manual",
  agenda: "Agenda",
  crm: "CRM",
  whatsapp: "WhatsApp",
  forms: "Formulários",
};

const fieldClass =
  "mt-1.5 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

function attributionLine(e: Entry): string | null {
  const parts: string[] = [];
  if (e.pageSlug) parts.push(`LP ${e.pageSlug}`);
  if (e.formName) parts.push(`Form ${e.formName}`);
  const products = e.metadata?.productNames;
  if (Array.isArray(products) && products.length && typeof products[0] === "string") {
    parts.push(products[0]);
  }
  return parts.length ? parts.join(" · ") : null;
}

function amountTone(type: string) {
  if (type === "INCOME") return "text-[var(--success)]";
  if (type === "REFUND") return "text-[var(--ink-muted-80)]";
  return "text-[var(--danger)]";
}

export default function FinancePage() {
  const qc = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["finance-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });

  const effective = workspaceId || clientes[0]?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: ["finance-ledger", effective, sourceFilter],
    queryFn: async () => {
      const q = new URLSearchParams({ workspaceId: effective });
      if (sourceFilter) q.set("source", sourceFilter);
      const r = await fetch(`/api/atrako/finance?${q}`);
      if (!r.ok) throw new Error("Falha ao carregar financeiro");
      return r.json() as Promise<{
        summary: {
          income: number;
          expense: number;
          refund: number;
          net: number;
          count: number;
        };
        entries: Entry[];
      }>;
    },
    enabled: Boolean(effective),
  });

  const summary = data?.summary;
  const entries = data?.entries ?? [];

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    if (!effective || !Number.isFinite(n) || n === 0) {
      setError("Informe um valor diferente de zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effective,
          type: n < 0 ? "EXPENSE" : "INCOME",
          amount: Math.abs(n),
          source: "manual",
          description: desc.trim() || "Lançamento manual",
          idempotencyKey: `manual:${effective}:${Date.now()}`,
        }),
      });
      if (!r.ok) throw new Error("Não foi possível lançar.");
      setDesc("");
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["finance-ledger", effective] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível lançar.");
    } finally {
      setSaving(false);
    }
  }

  const sources = useMemo(() => {
    const s = new Set(["commerce", "manual", "agenda", "crm", "whatsapp", "forms"]);
    for (const e of entries) s.add(e.source);
    if (sourceFilter) s.add(sourceFilter);
    return Array.from(s).sort();
  }, [entries, sourceFilter]);

  const showWorkspaceSelect = clientes.length > 1;

  return (
    <AppPage
      title="Caixa"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {showWorkspaceSelect ? (
            <PillSelect
              size="toolbar"
              value={effective}
              onChange={setWorkspaceId}
              options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
              aria-label="Empresa"
            />
          ) : null}
          <PillSelect
            size="toolbar"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: "", label: "Todas as origens" },
              ...sources.map((s) => ({ value: s, label: sourceLabel(s) })),
            ]}
            aria-label="Origem"
          />
        </div>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="caixa-shell">
          <div className="caixa-kpi-grid">
            <div className="caixa-saldo-card">
              <p className="type-fine-print text-[var(--body-muted)]">Saldo</p>
              <p className="type-tagline tabular-nums text-[var(--on-dark)]">
                {brl(summary?.net ?? 0)}
              </p>
              <p className="type-fine-print text-[var(--body-muted)]">
                {summary?.count ?? 0} lançamento
                {(summary?.count ?? 0) === 1 ? "" : "s"}
              </p>
            </div>

            <div className="caixa-kpi-card">
              <span className="caixa-kpi-icon" data-tone="in">
                <ArrowDownLeft className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <p className="type-fine-print text-[var(--ink-muted-48)]">Receitas</p>
              <p className="mt-auto type-tagline tabular-nums text-[var(--success)]">
                {brl(summary?.income ?? 0)}
              </p>
            </div>

            <div className="caixa-kpi-card">
              <span className="caixa-kpi-icon" data-tone="out">
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <p className="type-fine-print text-[var(--ink-muted-48)]">Despesas</p>
              <p className="mt-auto type-tagline tabular-nums text-[var(--danger)]">
                {brl(summary?.expense ?? 0)}
              </p>
            </div>

            <div className="caixa-kpi-card">
              <span className="caixa-kpi-icon" data-tone="refund">
                <RefreshCcw className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <p className="type-fine-print text-[var(--ink-muted-48)]">Reembolsos</p>
              <p className="mt-auto type-tagline tabular-nums text-[var(--ink-muted-80)]">
                {brl(summary?.refund ?? 0)}
              </p>
            </div>
          </div>

          <form onSubmit={addManual} className="caixa-manual">
            <div>
              <h2 className="type-caption-strong text-[var(--ink)]">Lançamento manual</h2>
              <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                Valor negativo = despesa
              </p>
            </div>
            <div className="caixa-manual-row">
              <label className="min-w-0 flex-1">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">Descrição</span>
                <input
                  className={fieldClass}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ex.: Aluguel"
                />
              </label>
              <label className="w-full sm:w-36">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">Valor</span>
                <input
                  className={fieldClass}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </label>
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !effective}
                className="h-11 w-full sm:w-auto"
              >
                {saving ? "…" : "Lançar"}
              </Button>
            </div>
            {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
          </form>

          <section className="caixa-ledger">
            <div className="caixa-ledger-head">
              <h2 className="type-caption-strong text-[var(--ink)]">Extrato</h2>
            </div>

            {entries.length === 0 ? (
              <div className="caixa-ledger-empty">
                <p className="type-caption text-[var(--ink-muted-48)]">
                  Nenhum lançamento ainda
                </p>
              </div>
            ) : (
              <ul className="caixa-ledger-list">
                {entries.map((e) => {
                  const attr = attributionLine(e);
                  return (
                  <li key={e.id} className="caixa-ledger-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate type-caption-strong text-[var(--ink)]">
                          {e.description || e.type}
                        </p>
                        <span className="rounded-[var(--radius-xs)] bg-[var(--surface-chip-translucent)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-80)]">
                          {sourceLabel(e.source)}
                        </span>
                      </div>
                      <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                        {new Date(e.occurredAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {attr ? ` · ${attr}` : null}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 type-caption-strong tabular-nums ${amountTone(e.type)}`}
                    >
                      {e.type === "INCOME" ? "+" : "−"}
                      {brl(e.amount)}
                    </p>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppPage>
  );
}
