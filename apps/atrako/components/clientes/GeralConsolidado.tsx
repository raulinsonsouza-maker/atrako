"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

type Consolidado = {
  totais: {
    receita: number;
    pedidos: number;
    ticketMedio: number;
    investimento: number;
    roas: number | null;
    leadsCrm: number;
    leadsMidia: number;
    roasSemRelacionamento?: number | null;
  };
  relacionamento?: {
    receitaAtribuida: number;
    pedidosAtribuidos: number;
    receitaInfluenciada: number;
    pedidosInfluenciados: number;
    custoWhatsApp: number;
    participacao: number | null;
  };
  canaisVenda: Array<{ id: string; label: string; pedidos: number; receitaCents: number }>;
  canaisMidia: Array<{
    id: string;
    label: string;
    investimento: number;
    leads: number;
    compras: number;
    receitaAtribuida: number;
  }>;
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 type-tagline tabular-nums text-[var(--foreground)]">{value}</p>
      <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{hint}</p>
    </div>
  );
}

export function GeralConsolidado({
  clienteId,
  query,
}: {
  clienteId: string;
  /** Mesmos params de período do resumo (periodo, dataInicio, dataFim). */
  query: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-consolidado", clienteId, query],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/consolidado?${query}`);
      if (!res.ok) throw new Error("Falha ao carregar visão geral");
      return (await res.json()) as Consolidado;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 type-caption text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Somando todos os canais…
      </div>
    );
  }

  const { totais, canaisVenda, canaisMidia, relacionamento: rel } = data;
  const showRel = Boolean(rel && (rel.pedidosAtribuidos > 0 || rel.pedidosInfluenciados > 0 || rel.custoWhatsApp > 0));
  const maxReceita = Math.max(1, ...canaisVenda.map((c) => c.receitaCents));

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Receita"
          value={brl(totais.receita)}
          hint={`${canaisVenda.length} canal(is) de venda no período`}
        />
        <Kpi
          label="Pedidos"
          value={totais.pedidos.toLocaleString("pt-BR")}
          hint={`Ticket médio ${brl(totais.ticketMedio)}`}
        />
        <Kpi
          label="Leads"
          value={totais.leadsCrm.toLocaleString("pt-BR")}
          hint={`CRM (sem compradores) · ${totais.leadsMidia.toLocaleString("pt-BR")} de anúncios`}
        />
        <Kpi
          label="Investimento"
          value={brl(totais.investimento)}
          hint={`${canaisMidia.length} canal(is) de mídia`}
        />
        <Kpi
          label="ROAS geral"
          value={totais.roas != null ? `${totais.roas.toLocaleString("pt-BR")}x` : "—"}
          hint="Receita de todos os canais ÷ investimento"
        />
        <Kpi
          label="Custo por pedido"
          value={
            totais.pedidos > 0 && totais.investimento > 0
              ? brl(totais.investimento / totais.pedidos)
              : "—"
          }
          hint="Investimento ÷ pedidos"
        />
      </div>

      {showRel && rel ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            label="Receita via relacionamento"
            value={brl(rel.receitaAtribuida)}
            hint={`${rel.pedidosAtribuidos.toLocaleString("pt-BR")} pedidos atribuídos a e-mail/WhatsApp${
              rel.participacao != null ? ` · ${rel.participacao.toLocaleString("pt-BR")}% da receita` : ""
            } · já incluída na receita acima`}
          />
          <Kpi
            label="Influenciada"
            value={brl(rel.receitaInfluenciada)}
            hint={`${rel.pedidosInfluenciados.toLocaleString("pt-BR")} pedidos de quem recebeu mensagem sem clicar`}
          />
          <Kpi
            label="ROAS só da mídia"
            value={totais.roasSemRelacionamento != null ? `${totais.roasSemRelacionamento.toLocaleString("pt-BR")}x` : "—"}
            hint={`Receita sem a parte do relacionamento ÷ investimento · WhatsApp ${brl(rel.custoWhatsApp)}`}
          />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Vendas por canal
          </p>
          {canaisVenda.length === 0 ? (
            <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">
              Nenhuma venda no período.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {canaisVenda.map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-caption-strong text-[var(--foreground)]">{c.label}</span>
                    <span className="type-caption tabular-nums text-[var(--foreground)]">
                      {brl(c.receitaCents / 100)}
                      <span className="ml-2 text-[var(--muted-foreground)]">
                        {c.pedidos.toLocaleString("pt-BR")} pedidos
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.max(2, (c.receitaCents / maxReceita) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Mídia por canal
          </p>
          {canaisMidia.length === 0 ? (
            <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">
              Nenhum investimento em anúncios no período.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {canaisMidia.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="type-caption-strong text-[var(--foreground)]">{c.label}</span>
                  <span className="type-caption tabular-nums text-[var(--foreground)]">
                    {brl(c.investimento)}
                    <span className="ml-2 text-[var(--muted-foreground)]">
                      {c.leads.toLocaleString("pt-BR")} leads
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
